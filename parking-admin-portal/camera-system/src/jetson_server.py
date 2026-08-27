"""
jetson_server.py — Jetson Parking System Backend
=================================================
Standalone Flask backend for the Jetson device. Manages its own SQLite
vehicles table and exposes REST API endpoints for the display screen
and ANPR plate push notifications.

Usage:
    python -m src.jetson_server

Endpoints:
    POST /api/plate/entry   → ANPR pushes an entry detection
    POST /api/plate/exit    → ANPR pushes an exit detection
    GET  /api/status        → display screen polls this
    GET  /api/log           → full vehicle history
    GET  /api/health        → heartbeat
"""

import sqlite3
from datetime import datetime

from flask import Flask, request, jsonify
from flask_cors import CORS

from src.config import (
    PARKING_DB,
    TOTAL_PARKING_SLOTS,
    JETSON_SERVER_HOST,
    JETSON_SERVER_PORT,
)

app = Flask(__name__)
CORS(app)

DB_PATH = str(PARKING_DB)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS vehicles (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            plate       TEXT    NOT NULL,
            entry_time  TEXT    NOT NULL,
            exit_time   TEXT,
            status      TEXT    DEFAULT 'inside'   -- 'inside' | 'exited'
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS config (
            key   TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    # Store total capacity
    c.execute("""
        INSERT OR IGNORE INTO config (key, value)
        VALUES ('total_slots', ?)
    """, (str(TOTAL_PARKING_SLOTS),))

    conn.commit()
    conn.close()
    print(f"[DB] Initialized → {DB_PATH}")


# ── API: ANPR pushes a detected plate ───────────────────────────────────
@app.route("/api/plate/entry", methods=["POST"])
def plate_entry():
    """Called by ANPR when a vehicle ENTERS."""
    data = request.get_json(force=True)
    plate = data.get("plate", "").strip().upper()

    if not plate:
        return jsonify({"error": "plate required"}), 400

    conn = get_db()
    c = conn.cursor()

    # Prevent duplicate active entry
    existing = c.execute(
        "SELECT id FROM vehicles WHERE plate=? AND status='inside'", (plate,)
    ).fetchone()

    if existing:
        conn.close()
        return jsonify({"status": "already_inside", "plate": plate}), 200

    now = datetime.now().isoformat()
    c.execute(
        "INSERT INTO vehicles (plate, entry_time, status) VALUES (?,?,?)",
        (plate, now, "inside"),
    )
    conn.commit()
    conn.close()

    print(f"[ENTRY] {plate} at {now}")
    return jsonify({"status": "entered", "plate": plate, "entry_time": now}), 201


@app.route("/api/plate/exit", methods=["POST"])
def plate_exit():
    """Called by ANPR when a vehicle EXITS."""
    data = request.get_json(force=True)
    plate = data.get("plate", "").strip().upper()

    if not plate:
        return jsonify({"error": "plate required"}), 400

    conn = get_db()
    c = conn.cursor()
    now = datetime.now().isoformat()

    result = c.execute(
        "UPDATE vehicles SET exit_time=?, status='exited' WHERE plate=? AND status='inside'",
        (now, plate),
    )
    conn.commit()
    conn.close()

    if result.rowcount == 0:
        return jsonify({"error": "vehicle not found inside"}), 404

    print(f"[EXIT]  {plate} at {now}")
    return jsonify({"status": "exited", "plate": plate, "exit_time": now}), 200


# ── API: Display screen polls this ──────────────────────────────────────
@app.route("/api/status", methods=["GET"])
def get_status():
    """Main status endpoint for the display screen."""
    conn = get_db()
    c = conn.cursor()

    total_slots = int(
        c.execute("SELECT value FROM config WHERE key='total_slots'")
        .fetchone()["value"]
    )

    occupied = c.execute(
        "SELECT COUNT(*) as cnt FROM vehicles WHERE status='inside'"
    ).fetchone()["cnt"]

    available = max(0, total_slots - occupied)

    # Recent 10 entries (most recent first)
    recent = c.execute("""
        SELECT plate, entry_time, status
        FROM vehicles
        ORDER BY id DESC
        LIMIT 10
    """).fetchall()

    conn.close()

    return jsonify({
        "total_slots": total_slots,
        "occupied": occupied,
        "available": available,
        "occupancy_pct": round((occupied / total_slots) * 100, 1) if total_slots else 0,
        "recent_plates": [
            {
                "plate": r["plate"],
                "entry_time": r["entry_time"],
                "status": r["status"],
            }
            for r in recent
        ],
        "server_time": datetime.now().isoformat(),
    })


# ── API: Full log for history view ──────────────────────────────────────
@app.route("/api/log", methods=["GET"])
def get_log():
    limit = int(request.args.get("limit", 50))
    conn = get_db()
    c = conn.cursor()

    rows = c.execute("""
        SELECT plate, entry_time, exit_time, status
        FROM vehicles
        ORDER BY id DESC
        LIMIT ?
    """, (limit,)).fetchall()

    conn.close()

    return jsonify([dict(r) for r in rows])


# ── API: Health check ────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": datetime.now().isoformat()})


if __name__ == "__main__":
    init_db()
    print(f"[SERVER] Starting Jetson Parking API on http://{JETSON_SERVER_HOST}:{JETSON_SERVER_PORT}")
    print(f"[SERVER] Total slots configured: {TOTAL_PARKING_SLOTS}")
    app.run(host=JETSON_SERVER_HOST, port=JETSON_SERVER_PORT, debug=False)
