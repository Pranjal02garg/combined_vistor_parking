"""
config.py — Centralized configuration for the Smart Parking system.

All other modules import settings from here instead of reading .env
or hardcoding values themselves.
"""

import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    print("ERROR: 'python-dotenv' not installed. Run: pip install python-dotenv", file=sys.stderr)
    sys.exit(1)

# ── Paths ───────────────────────────────────────────────────────────────
# PROJECT_ROOT is the repository root (parent of src/).
SRC_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SRC_DIR.parent

# ── Load .env ───────────────────────────────────────────────────────────
_env_path = PROJECT_ROOT / ".env"
if _env_path.is_file():
    load_dotenv(_env_path)

# ── MongoDB ─────────────────────────────────────────────────────────────
MONGODB_URI = os.getenv("MONGODB_URI", "")
MONGODB_FALLBACK_DB = "parking_app"
MONGODB_COLLECTION = "car_changes"

# ── ANPR Camera ─────────────────────────────────────────────────────────
CAM_HOST = os.getenv("CAM_HOST", "172.31.172.32")
ENTRY_CAM_IP = os.getenv("ENTRY_CAM_IP", CAM_HOST)
EXIT_CAM_IP = os.getenv("EXIT_CAM_IP", "172.31.172.31")
CAM_USER = os.getenv("CAM_USER", "admin")
CAM_PASS = os.getenv("CAM_PASS", os.getenv("PASS", "Pilot@Parking"))
CAM_USERNAME = CAM_USER  # alias used by occupancy tracker
CAM_PASSWORD = CAM_PASS

# ── Camera API Paths ────────────────────────────────────────────────────
LOGIN_PATH = "/API/Web/Login"
HEARTBEAT_PATH = "/API/Login/Heartbeat"
ADD_PATH = "/API/AI/Plates/Add"
DELETE_PATH = os.getenv("CAM_DELETE_PATH", "/API/AI/Plates/Remove")
ALARM_PATH = os.getenv("CAM_ALARM_PATH", "/API/PreviewChannel/ManualAlarm/Set")
CHECK_PATH = "/API/Event/Check"
VERIFY_TLS = False

# ── Polling ─────────────────────────────────────────────────────────────
POLL_INTERVAL_SEC = int(os.getenv("POLL_INTERVAL_SEC", "3"))
HEARTBEAT_INTERVAL_SEC = int(os.getenv("HEARTBEAT_INTERVAL_SEC", "10"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "5"))
REQUEST_TIMEOUT = 10  # seconds per HTTP call
POLL_INTERVAL = 1.0  # camera poll interval for occupancy tracker

# ── Parking ─────────────────────────────────────────────────────────────
TOTAL_PARKING_SLOTS = int(os.getenv("TOTAL_PARKING_SLOTS", "100"))

# ── Database Paths ──────────────────────────────────────────────────────
CONFIG_DB = PROJECT_ROOT / "config.db"
PARKING_DB = PROJECT_ROOT / "parking.db"

# ── Display API ─────────────────────────────────────────────────────────
DISPLAY_API_HOST = os.getenv("DISPLAY_API_HOST", "0.0.0.0")
DISPLAY_API_PORT = int(os.getenv("DISPLAY_API_PORT", "5055"))

# ── Jetson Server ───────────────────────────────────────────────────────
JETSON_SERVER_HOST = os.getenv("JETSON_SERVER_HOST", "0.0.0.0")
JETSON_SERVER_PORT = int(os.getenv("JETSON_SERVER_PORT", "5000"))

# ── GrpId semantics ────────────────────────────────────────────────────
GRP_ALLOWED = 1
GRP_BLOCKED = 2
GRP_UNKNOWN = 3
