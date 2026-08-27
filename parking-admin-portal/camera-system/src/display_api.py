"""
display_api.py — REST API for the parking display screen.

Reads the SAME parking.db that occupancy_tracker.py writes to
(read-only, WAL mode so it never blocks the writer).

Usage:
    python -m src.display_api

Endpoints:
    GET /api/status        → live stats for the display screen
    GET /api/recent?n=10   → n most recent entries (snap_id + timestamp)
    GET /api/health        → heartbeat
"""

import sqlite3
import threading
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS

from src.config import (
    PARKING_DB,
    TOTAL_PARKING_SLOTS,
    DISPLAY_API_HOST,
    DISPLAY_API_PORT,
)

# ─── App Setup ──────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)
_lock = threading.Lock()  # extra safety around reads


def _get_conn():
    """Open a read-only WAL connection to parking.db."""
    conn = sqlite3.connect(
        f"file:{PARKING_DB}?mode=ro",
        uri=True,
        check_same_thread=False,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


# ── /api/status ──────────────────────────────────────────────────────────
@app.route("/api/status")
def status():
    with _lock:
        try:
            conn = _get_conn()
            cur = conn.cursor()
            occupied = cur.execute("SELECT COUNT(*) FROM cars_inside").fetchone()[0]
            conn.close()
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    available = max(0, TOTAL_PARKING_SLOTS - occupied)
    occupancy_pct = round((occupied / TOTAL_PARKING_SLOTS) * 100, 1) if TOTAL_PARKING_SLOTS else 0

    return jsonify({
        "total_slots": TOTAL_PARKING_SLOTS,
        "occupied": occupied,
        "available": available,
        "occupancy_pct": occupancy_pct,
        "server_time": datetime.now().isoformat(),
    })


# ── /api/recent ──────────────────────────────────────────────────────────
@app.route("/api/recent")
def recent():
    n = min(int(request.args.get("n", 10)), 50)
    with _lock:
        try:
            conn = _get_conn()
            rows = conn.execute(
                "SELECT snap_id, grp_id, entered FROM cars_inside ORDER BY entered DESC LIMIT ?",
                (n,),
            ).fetchall()
            conn.close()
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return jsonify([
        {
            "snap_id": r["snap_id"],
            "grp_id": r["grp_id"],
            "entered": r["entered"],
        }
        for r in rows
    ])


# ── /api/health ───────────────────────────────────────────────────────────
@app.route("/api/health")
def health():
    db_ok = PARKING_DB.exists()
    return jsonify({
        "status": "ok" if db_ok else "db_missing",
        "db_exists": db_ok,
        "server_time": datetime.now().isoformat(),
    })


if __name__ == "__main__":
    print(f"[Display API] parking.db  → {PARKING_DB.resolve()}")
    print(f"[Display API] Total slots → {TOTAL_PARKING_SLOTS}")
    print(f"[Display API] Listening   → http://{DISPLAY_API_HOST}:{DISPLAY_API_PORT}")
    app.run(host=DISPLAY_API_HOST, port=DISPLAY_API_PORT, debug=False, threaded=True)
