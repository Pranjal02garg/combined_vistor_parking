#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
#  start_parking.sh  —  Master Startup Script for JETSON / Linux
#  Runs occupancy_tracker, display_api, and the Chromium Kiosk together.
# ═══════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "[SYSTEM] Starting Parking OS..."

# 1. Start the main ANPR dual camera backend
echo "[SYSTEM] Launching dual.py (ANPR Backend)..."
python3 -m src.dual &
TRACKER_PID=$!

# 2. Start the Display API (serves data to the UI)
echo "[SYSTEM] Launching display_api.py (UI Backend)..."
python3 -m src.display_api &
API_PID=$!

# Start plate sync
echo "[SYSTEM] Launching plate_sync.py..."
python3 -m src.plate_sync &
SYNC_PID=$!

# Wait a moment for APIs to bind
sleep 3

# 3. Start the Kiosk UI
echo "[SYSTEM] Launching display UI..."
chmod +x "$SCRIPT_DIR/launch_kiosk.sh"
"$SCRIPT_DIR/launch_kiosk.sh" &
KIOSK_PID=$!

# Handle graceful shutdown
trap "echo '[SYSTEM] Stopping all services...'; kill $TRACKER_PID $API_PID $KIOSK_PID 2>/dev/null; exit 0" SIGINT SIGTERM

echo "[SYSTEM] All services running! (Press Ctrl+C to stop)"
wait
