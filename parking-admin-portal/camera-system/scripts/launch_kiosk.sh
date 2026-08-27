#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
#  launch_kiosk.sh  —  Parking Display launcher for JETSON (Linux/ARM)
#
#  Usage:
#    chmod +x launch_kiosk.sh
#    ./launch_kiosk.sh
# ═══════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HTML_FILE="${SCRIPT_DIR}/../kiosk-display/index.html"

echo "[PARKING DISPLAY] Script dir: $SCRIPT_DIR"
echo "[PARKING DISPLAY] HTML file : $HTML_FILE"

# ── Disable screen blanking / sleep ───────────────────────────────────
xset s off 2>/dev/null
xset s noblank 2>/dev/null
xset -dpms 2>/dev/null

# ── Kill any existing browser instance ────────────────────────────────
pkill -f chromium-browser 2>/dev/null
pkill -f chromium 2>/dev/null
pkill -f google-chrome 2>/dev/null
sleep 1

# ── Common kiosk flags ────────────────────────────────────────────────
KIOSK_FLAGS=(
  --kiosk
  --fullscreen
  --start-fullscreen
  --start-maximized
  --no-first-run
  --noerrdialogs
  --disable-infobars
  --disable-session-crashed-bubble
  --disable-restore-session-state
  --disable-translate
  --disable-features=TranslateUI
  --overscroll-history-navigation=0
  --disable-pinch
  --no-default-browser-check
  --disable-component-update
  --check-for-update-interval=31536000
  --disable-background-networking
  --disable-default-apps
  --disable-sync
  --metrics-recording-only
  --safebrowsing-disable-auto-update
  --password-store=basic
  --use-mock-keychain
  --incognito
)

# ── Launch (try chromium-browser → chromium → google-chrome) ──────────
if command -v chromium-browser &>/dev/null; then
    echo "[PARKING DISPLAY] Launching chromium-browser..."
    chromium-browser "${KIOSK_FLAGS[@]}" "file://${HTML_FILE}" &

elif command -v chromium &>/dev/null; then
    echo "[PARKING DISPLAY] Launching chromium..."
    chromium "${KIOSK_FLAGS[@]}" "file://${HTML_FILE}" &

elif command -v google-chrome &>/dev/null; then
    echo "[PARKING DISPLAY] Launching google-chrome..."
    google-chrome "${KIOSK_FLAGS[@]}" "file://${HTML_FILE}" &

else
    echo "[ERROR] No Chromium/Chrome browser found!"
    echo "Install with:  sudo apt install chromium-browser"
    exit 1
fi

echo "[PARKING DISPLAY] Browser launched in kiosk mode."
echo "[PARKING DISPLAY] Press Ctrl+C to stop watching (browser keeps running)."

# Keep script alive so @reboot cron doesn't kill the browser
wait
