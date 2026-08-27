"""
occupancy_tracker.py — Dual-Camera ANPR Parking Occupancy Tracker
-----------------------------------------------------------------
Polls entry and exit ANPR cameras via HTTP, tracks which cars are
currently inside the lot in a persistent SQLite database (parking.db).

Camera IPs are read from config.db (use scripts/change_ip.bat/.sh to update).

Usage:
    python -m src.occupancy_tracker
"""

import json
import sqlite3
import threading
import time
from datetime import datetime
from pathlib import Path

import requests
import urllib3
from requests.auth import HTTPDigestAuth

from src.config import (
    CAM_USERNAME,
    CAM_PASSWORD,
    ENTRY_CAM_IP,
    EXIT_CAM_IP,
    CHECK_PATH,
    VERIFY_TLS,
    POLL_INTERVAL,
    HEARTBEAT_INTERVAL_SEC,
    CONFIG_DB,
    PARKING_DB,
    GRP_ALLOWED,
    GRP_BLOCKED,
    GRP_UNKNOWN,
)

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


# ======================================================================
#  Config store  (camera IPs in SQLite so change_ip scripts can update)
# ======================================================================
class ConfigStore:
    """Reads/writes camera IP addresses from config.db.

    Schema
    ------
    cameras(role TEXT PRIMARY KEY, ip TEXT NOT NULL)

    Roles: 'entry', 'exit'
    """

    def __init__(self, path: Path):
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA synchronous=NORMAL;")
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cameras (
                role TEXT PRIMARY KEY,
                ip   TEXT NOT NULL
            )
            """
        )
        self._conn.commit()

    def get_ip(self, role: str) -> str | None:
        """Return the IP for *role* ('entry' or 'exit'), or None if unset."""
        row = self._conn.execute(
            "SELECT ip FROM cameras WHERE role = ?", (role,)
        ).fetchone()
        return row[0] if row else None

    def set_ip(self, role: str, ip: str):
        """Upsert an IP for *role*."""
        self._conn.execute(
            "INSERT INTO cameras (role, ip) VALUES (?, ?) "
            "ON CONFLICT(role) DO UPDATE SET ip = excluded.ip",
            (role, ip),
        )
        self._conn.commit()


# ======================================================================
#  Persistent occupancy store  (SQLite, O(1) ops, crash-durable)
# ======================================================================
class ParkingStore:
    """Thread-safe persistent set of cars currently inside the lot.

    All mutating ops are O(1) thanks to the primary-key index on snap_id.
    A single lock serialises access because sqlite3 connections are not
    safe to share across threads without explicit serialisation.
    """

    def __init__(self, path: Path):
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA synchronous=NORMAL;")
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cars_inside (
                snap_id  TEXT PRIMARY KEY,
                grp_id   INTEGER,
                entered  TEXT
            )
            """
        )
        self._conn.commit()

    def add_car(self, snap_id: str, grp_id: int) -> bool:
        """Add an allowed car. Returns True if newly added, False if duplicate."""
        with self._lock:
            cur = self._conn.execute(
                "INSERT OR IGNORE INTO cars_inside (snap_id, grp_id, entered) "
                "VALUES (?, ?, ?)",
                (snap_id, grp_id, datetime.now().isoformat(timespec="seconds")),
            )
            self._conn.commit()
            return cur.rowcount == 1

    def remove_car(self, snap_id: str) -> bool:
        """Remove a car on exit. Returns True if it was inside."""
        with self._lock:
            cur = self._conn.execute(
                "DELETE FROM cars_inside WHERE snap_id = ?", (snap_id,)
            )
            self._conn.commit()
            return cur.rowcount == 1

    def count(self) -> int:
        """Distinct cars currently inside."""
        with self._lock:
            (n,) = self._conn.execute(
                "SELECT COUNT(*) FROM cars_inside"
            ).fetchone()
            return n


# ======================================================================
#  Camera poller  (one instance per camera, runs in its own thread)
# ======================================================================
class CameraPoller:
    """Polls a single ANPR camera for plate detection events."""

    def __init__(self, name: str, base_url: str, on_plate):
        """
        name     : label for logs ("ENTRY" / "EXIT")
        base_url : camera portal host  e.g. https://192.168.1.2
        on_plate : callback(snap_id, grp_id) invoked per detected plate
        """
        self.name = name
        self.base_url = base_url
        self.on_plate = on_plate
        self.session = requests.Session()
        self.csrf = None
        self._reader_id = None
        self._sequence = None

    # ---------- helpers ----------
    def _log(self, msg: str):
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}][{self.name}] {msg}")

    @staticmethod
    def _is_session_dead(exc: requests.HTTPError) -> bool:
        resp = exc.response
        if resp is None:
            return False
        if resp.status_code in (401, 403):
            return True
        try:
            return resp.json().get("error_code") == "expired"
        except Exception:
            return False

    # ---------- auth ----------
    def login(self) -> str:
        self._reader_id = None
        self._sequence = None
        resp = self.session.post(
            f"{self.base_url}/API/Web/Login",
            auth=HTTPDigestAuth(CAM_USERNAME, CAM_PASSWORD),
            headers={"Content-Type": "application/json"},
            json={"data": {"remote_terminal_info": "WEB,chrome"}},
            timeout=5,
            verify=VERIFY_TLS,
        )
        resp.raise_for_status()
        csrf = resp.headers.get("X-Csrftoken") or resp.headers.get("Csrftoken")
        if not csrf:
            raise RuntimeError(
                f"No X-Csrftoken in login response: {dict(resp.headers)}"
            )
        self.csrf = csrf
        return csrf

    def relogin(self):
        while True:
            try:
                self.login()
                self._log("re-login successful")
                return
            except (requests.RequestException, RuntimeError) as e:
                self._log(f"re-login failed, retrying in 5 s: {e}")
                time.sleep(5)

    def heartbeat(self):
        ts = datetime.now().strftime("%Y-%m-%d@%H:%M:%S")
        resp = self.session.post(
            f"{self.base_url}/API/Login/Heartbeat?{ts}",
            headers={
                "Content-Type": "application/json; charset=UTF-8",
                "X-Csrftoken": self.csrf,
            },
            json={"version": "1.0", "data": {}, "actionType": "create"},
            timeout=5,
            verify=VERIFY_TLS,
        )
        resp.raise_for_status()

    # ---------- polling ----------
    def fetch_once(self) -> dict:
        ts = datetime.now().strftime("%Y-%m-%d@%H:%M:%S")
        url = f"{self.base_url}{CHECK_PATH}?{ts}"

        subscribe_type = [{"event": ["all"]}]
        if self._reader_id is not None:
            subscribe_type.append({"aipushpic": ["all"]})

        data: dict = {
            "plus_eventchk": "eventAiPushPic",
            "ext_data": {"subscribe_type": subscribe_type},
        }
        if self._reader_id is not None:
            data["reader_id"] = self._reader_id
            data["sequence"] = self._sequence
            data["lap_number"] = None

        resp = self.session.post(
            url,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json; charset=utf-8",
                "X-Csrftoken": self.csrf,
            },
            json={"version": "1.0", "data": data},
            timeout=10,
            verify=VERIFY_TLS,
        )
        resp.raise_for_status()
        result = resp.json()

        d = result.get("data", {})
        if "reader_id" in d:
            self._reader_id = d["reader_id"]
        if "sequence" in d:
            self._sequence = d["sequence"]
        return result

    # ---------- plate extraction ----------
    @staticmethod
    def _extract_plates(data: dict):
        """Yield (snap_id, grp_id) for each plate in a Check response."""
        plates = (
            data.get("data", {})
            .get("ai_snap_picture", {})
            .get("PlateInfo", [])
        )
        for p in plates:
            snap_id = p.get("SnapId") or p.get("snap_id")
            if snap_id is None:
                continue
            grp = (
                p.get("GrpId")
                if p.get("GrpId") is not None
                else p.get("grp_id")
            )
            try:
                grp = int(grp) if grp is not None else None
            except (TypeError, ValueError):
                grp = None
            yield str(snap_id), grp

    # ---------- main loop ----------
    def run(self):
        self._log("logging in...")
        self.relogin()
        self._log("polling started")

        last_heartbeat = time.monotonic()
        while True:
            # keep-alive
            if time.monotonic() - last_heartbeat >= HEARTBEAT_INTERVAL_SEC:
                try:
                    self.heartbeat()
                    last_heartbeat = time.monotonic()
                except requests.HTTPError as e:
                    if self._is_session_dead(e):
                        self._log("session expired (heartbeat), re-login...")
                        self.relogin()
                        last_heartbeat = time.monotonic()
                    else:
                        self._log(f"heartbeat failed: {e}")
                except requests.RequestException as e:
                    self._log(f"heartbeat failed: {e}")

            # poll
            try:
                data = self.fetch_once()
                for snap_id, grp_id in self._extract_plates(data):
                    self.on_plate(snap_id, grp_id)

            except requests.HTTPError as e:
                if self._is_session_dead(e):
                    self._log("session expired, re-login...")
                    self.relogin()
                    last_heartbeat = time.monotonic()
                else:
                    body = ""
                    no_hb = False
                    if e.response is not None:
                        try:
                            body = f" | body: {e.response.text[:200]}"
                            no_hb = "no_heartbeat" in e.response.text
                        except Exception:
                            pass
                    self._log(f"HTTP error: {e}{body}")
                    if no_hb:
                        self._log("recovering with immediate heartbeat...")
                        try:
                            self.heartbeat()
                            last_heartbeat = time.monotonic()
                        except requests.RequestException as hb:
                            self._log(f"heartbeat recovery failed: {hb}")
            except requests.RequestException as e:
                self._log(f"request failed: {e}")
            except json.JSONDecodeError:
                self._log("response wasn't valid JSON (auth redirect?)")

            time.sleep(POLL_INTERVAL)


# ======================================================================
#  Business logic callbacks
# ======================================================================
# Module-level store — initialised in main() after IPs are validated.
STORE: ParkingStore


def on_entry(snap_id: str, grp_id):
    """Car seen at ENTRY. Only track ALLOWED cars."""
    if grp_id == GRP_ALLOWED:
        newly = STORE.add_car(snap_id, grp_id)
        if newly:
            print(
                f"[ENTRY] +car {snap_id} (allowed) | inside now: {STORE.count()}"
            )
    else:
        label = f"grp={grp_id}"
        print(f"[ENTRY] car {snap_id} not allowed ({label}) - not tracked")


def on_exit(snap_id: str, grp_id):
    """Car seen at EXIT. Remove it from the store if present."""
    removed = STORE.remove_car(snap_id)
    if removed:
        print(f"[EXIT]  -car {snap_id} left | inside now: {STORE.count()}")


# ======================================================================
#  main
# ======================================================================
def main():
    global STORE

    # ---- load IPs from config DB ----
    cfg = ConfigStore(CONFIG_DB)

    entry_ip = cfg.get_ip("entry") or os.getenv("ENTRY_CAM_IP", ENTRY_CAM_IP)
    exit_ip = cfg.get_ip("exit") or os.getenv("EXIT_CAM_IP", EXIT_CAM_IP)

    if not entry_ip or not exit_ip:
        missing = []
        if not entry_ip:
            missing.append("entry")
        if not exit_ip:
            missing.append("exit")
        raise SystemExit(
            f"ERROR: IP address(es) not configured for role(s): "
            f"{', '.join(missing)}\n"
            f"Set ENTRY_CAM_IP/EXIT_CAM_IP in .env or run: scripts/change_ip.bat <entry_ip> <exit_ip>"
        )

    entry_url = f"https://{entry_ip}"
    exit_url = f"https://{exit_ip}"

    # ---- occupancy store ----
    STORE = ParkingStore(PARKING_DB)

    print(f"Config DB  : {CONFIG_DB.resolve()}")
    print(f"Parking DB : {PARKING_DB.resolve()}")
    print(f"Entry cam  : {entry_url}")
    print(f"Exit cam   : {exit_url}")
    print(f"Cars inside (restored from disk): {STORE.count()}\n")

    # ---- start pollers ----
    entry_poller = CameraPoller("ENTRY", entry_url, on_entry)
    exit_poller = CameraPoller("EXIT", exit_url, on_exit)

    t1 = threading.Thread(
        target=entry_poller.run, name="entry-poller", daemon=True
    )
    t2 = threading.Thread(
        target=exit_poller.run, name="exit-poller", daemon=True
    )
    t1.start()
    t2.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
