"""
plate_sync.py — MongoDB → ANPR Camera Plate Sync Worker
--------------------------------------------------------
24×7 background worker that watches the ``car_changes`` collection in
MongoDB and mirrors every pending record onto the Honeywell ANPR
camera's plate allowlist, then removes the record once applied.

Usage:
    python -m src.plate_sync

*** UNVERIFIED: the delete endpoint ***
Neither add_plate.bat nor the full API reference actually documents a
Plates/Delete call. DELETE_PATH is an assumption built by symmetry with
Add's payload shape. Before trusting in production, capture the real
endpoint from the camera's web UI DevTools.
"""

import logging
import signal
import sys
import threading
import time
from urllib.parse import urlparse

import requests

try:
    from pymongo import MongoClient, ASCENDING
    from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError, PyMongoError
except ImportError:
    print("ERROR: 'pymongo' not installed. Run: pip install pymongo", file=sys.stderr)
    sys.exit(1)

from src.config import (
    MONGODB_URI,
    MONGODB_FALLBACK_DB,
    MONGODB_COLLECTION,
    CAM_HOST,
    CAM_USER,
    CAM_PASS,
    ADD_PATH,
    DELETE_PATH,
    ALARM_PATH,
    POLL_INTERVAL_SEC,
    HEARTBEAT_INTERVAL_SEC,
    MAX_RETRIES,
    SRC_DIR,
)
from src.camera_client import CameraClient

# ── Logging ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(SRC_DIR.parent / "plate_sync_worker.log"),
    ],
)
log = logging.getLogger("smart_parking.plate_sync")

if MONGODB_URI:
    log.info("MONGODB_URI is set.")
else:
    log.warning("MONGODB_URI is EMPTY — this will fail. Check your .env file.")

# ── Graceful shutdown ───────────────────────────────────────────────────
stop_event = threading.Event()


def _handle_signal(signum, _frame):
    log.info("Received signal %s, shutting down after current cycle...", signum)
    stop_event.set()


signal.signal(signal.SIGINT, _handle_signal)
if hasattr(signal, "SIGTERM"):
    signal.signal(signal.SIGTERM, _handle_signal)


# ── Heartbeat loop ──────────────────────────────────────────────────────
def heartbeat_loop(cam: CameraClient) -> None:
    """Runs in a daemon thread, posting heartbeat every N seconds."""
    while not stop_event.is_set():
        try:
            cam.heartbeat()
        except Exception as exc:
            log.warning("Heartbeat failed (will retry next tick): %s", exc)
        stop_event.wait(HEARTBEAT_INTERVAL_SEC)


# ── MongoDB helpers ─────────────────────────────────────────────────────
def get_db_name(uri: str) -> str:
    """Extract database name from MongoDB URI, with fallback."""
    path = urlparse(uri).path.lstrip("/").split("?")[0]
    return path if path else MONGODB_FALLBACK_DB


def connect_mongo():
    """Connect to MongoDB with retry loop."""
    if not MONGODB_URI:
        log.critical("MONGODB_URI is not set. Check your .env file.")
        sys.exit(1)
    while not stop_event.is_set():
        try:
            client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
            client.admin.command("ping")
            log.info("Connected to MongoDB.")
            return client
        except (ConnectionFailure, ServerSelectionTimeoutError) as exc:
            log.error(
                "Could not connect to MongoDB (%s). Retrying in %ss...",
                exc, POLL_INTERVAL_SEC,
            )
            stop_event.wait(POLL_INTERVAL_SEC)
    return None


# ── Plate payload builders ──────────────────────────────────────────────
def _plate_info(doc: dict, plate: str) -> dict:
    """Build the PlateInfo object for the camera's Add endpoint."""
    return {
        "Id": plate,
        "GrpId": doc.get("grpId", 1),
        "PlateColor": doc.get("plateColor", 0),
        "Sex": doc.get("sex", 0),
        "CarBrand": doc.get("carBrand", ""),
        "CarType": doc.get("carType", ""),
        "Owner": doc.get("owner", doc.get("userEmail", "")),
        "IdCode": doc.get("idCode", ""),
        "Domicile": doc.get("domicile", ""),
        "EnableChnAlarm": doc.get("enableChnAlarm", []),
        "Job": doc.get("job", ""),
        "Phone": doc.get("phone", ""),
        "Remark": doc.get("remark", ""),
    }


# Field name candidates — the MongoDB schema uses inconsistent casing.
PLATE_FIELD_CANDIDATES = [
    "car number", "carNumber", "car_number", "plate", "plateNumber", "Plate",
]
ACTION_FIELD_CANDIDATES = ["action", "Action"]


def _lookup(doc: dict, candidates: list) -> tuple:
    """Return (value, key_used) for the first matching candidate key."""
    for key in candidates:
        val = doc.get(key)
        if val:
            return val, key
    return None, None


def _visible_keys(doc: dict) -> list:
    """Return user-relevant keys (hide internal fields)."""
    return [k for k in doc.keys() if k not in ("_id", "retryCount", "lastError", "failed")]


# ── Document processing ────────────────────────────────────────────────
def process_doc(cam: CameraClient, doc: dict) -> None:
    """Process a single car_changes document — add or delete a plate, or trigger manual alarm."""
    action, action_key = _lookup(doc, ACTION_FIELD_CANDIDATES)
    
    if not action:
        raise ValueError(
            f"No action field found (tried {ACTION_FIELD_CANDIDATES}). "
            f"This document's actual keys are: {_visible_keys(doc)}."
        )

    action_norm = str(action).strip().lower()
    
    # Bypass plate checks for alarm actions
    if action_norm in ("alarm_on", "alarm_off"):
        alarm_val = True if action_norm == "alarm_on" else False
        payload = {
            "version": "1.0",
            "data": {"Local->1": alarm_val},
        }
        cam.call(ALARM_PATH, payload)
        log.info("Sent manual alarm %s to camera.", "ON" if alarm_val else "OFF")
        return

    plate, plate_key = _lookup(doc, PLATE_FIELD_CANDIDATES)

    if not plate:
        raise ValueError(
            f"No plate field found (tried {PLATE_FIELD_CANDIDATES}). "
            f"This document's actual keys are: {_visible_keys(doc)}. "
            f"Full doc: {doc}"
        )

    log.debug(
        "Matched plate via key '%s', action via key '%s' -> action=%s",
        plate_key, action_key, action_norm,
    )

    if action_norm == "add":
        payload = {
            "version": "1.0",
            "data": {"MsgId": "", "PlateInfo": [_plate_info(doc, plate)]},
        }
        cam.call(ADD_PATH, payload)
    elif action_norm == "delete":
        # UNVERIFIED endpoint/payload — see module docstring.
        payload = {
            "version": "1.0",
            "data": {"MsgId": "", "PlateInfo": [{"Id": plate}]},
        }
        cam.call(DELETE_PATH, payload)
    else:
        raise ValueError(f"Unrecognized action '{action}' (expected 'add' or 'delete').")


def _record_failure(col, doc_id, doc: dict, error_msg: str) -> None:
    """Bump retry counter; mark 'failed' after MAX_RETRIES to avoid poison messages."""
    retries = doc.get("retryCount", 0) + 1
    update = {"$set": {"retryCount": retries, "lastError": error_msg}}
    plate = doc.get("car number", "?")

    if retries >= MAX_RETRIES:
        update["$set"]["failed"] = True
        log.critical(
            "Plate %s: '%s' failed %s time(s), giving up: %s. "
            "Marked failed=true; fix and clear the flag manually to retry.",
            plate, doc.get("action", "?"), retries, error_msg,
        )
    else:
        log.warning(
            "Plate %s: '%s' failed (attempt %s/%s): %s",
            plate, doc.get("action", "?"), retries, MAX_RETRIES, error_msg,
        )

    try:
        col.update_one({"_id": doc_id}, update)
    except PyMongoError as exc:
        log.error("Could not record failure on doc %s: %s", doc_id, exc)


# ── Main loop ───────────────────────────────────────────────────────────
def run() -> None:
    """Main entry point — connect to MongoDB + camera and start syncing."""
    client = connect_mongo()
    if client is None:
        return
    col = client[get_db_name(MONGODB_URI)][MONGODB_COLLECTION]

    cam = CameraClient(CAM_HOST, CAM_USER, CAM_PASS)
    hb_thread = threading.Thread(target=heartbeat_loop, args=(cam,), daemon=True)
    hb_thread.start()

    db_name = get_db_name(MONGODB_URI)
    total_in_collection = col.count_documents({})
    log.info(
        "Starting plate sync worker. DB=%s Collection=%s (total docs right now: %s) "
        "Camera=%s Poll=%ss Heartbeat=%ss MaxRetries=%s",
        db_name, MONGODB_COLLECTION, total_in_collection,
        CAM_HOST, POLL_INTERVAL_SEC, HEARTBEAT_INTERVAL_SEC, MAX_RETRIES,
    )
    if total_in_collection and not list(col.find().limit(1)):
        log.warning(
            "count_documents found %s but find() returned nothing — "
            "unexpected, check permissions.", total_in_collection,
        )

    while not stop_event.is_set():
        try:
            docs = list(col.find({"failed": {"$ne": True}}).sort("_id", ASCENDING))
            log.info(
                "Poll cycle: %s pending record(s) found (failed ones excluded).",
                len(docs),
            )
        except PyMongoError as exc:
            log.error("Mongo read failed (%s). Reconnecting...", exc)
            try:
                client.close()
            except Exception:
                pass
            client = connect_mongo()
            if client is None:
                break
            col = client[get_db_name(MONGODB_URI)][MONGODB_COLLECTION]
            stop_event.wait(POLL_INTERVAL_SEC)
            continue

        for doc in docs:
            doc_id = doc["_id"]
            plate = doc.get("car number", "?")
            action = doc.get("action", "?")
            try:
                process_doc(cam, doc)
                col.delete_one({"_id": doc_id})
                log.info(
                    "Applied '%s' for plate %s and removed it from the queue.",
                    action, plate,
                )
            except requests.exceptions.HTTPError as exc:
                status = exc.response.status_code if exc.response is not None else None
                _record_failure(col, doc_id, doc, f"HTTP {status}: {exc}")
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as exc:
                log.error("Camera unreachable (%s). Will retry next cycle.", exc)
                break  # camera is down; skip remaining batch
            except Exception as exc:
                _record_failure(col, doc_id, doc, str(exc))

        stop_event.wait(POLL_INTERVAL_SEC)

    log.info("Worker stopped.")
    try:
        client.close()
    except Exception:
        pass


if __name__ == "__main__":
    run()
