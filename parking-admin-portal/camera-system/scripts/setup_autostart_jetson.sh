#!/bin/bash
# Run this script ONCE on your Jetson to make the system start automatically on boot.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/parking_system.desktop"

mkdir -p "$AUTOSTART_DIR"

cat <<EOF > "$DESKTOP_FILE"
[Desktop Entry]
Type=Application
Exec=bash -c "sleep 10 && $SCRIPT_DIR/start_parking.sh"
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=Smart Parking System
Comment=Starts the ANPR backend and Kiosk UI on boot
EOF

chmod +x "$SCRIPT_DIR/start_parking.sh"
chmod +x "$SCRIPT_DIR/launch_kiosk.sh"

echo "✅ Auto-boot enabled!"
echo "The parking system will now start automatically whenever the Jetson boots up and logs in."
echo "Desktop entry created at: $DESKTOP_FILE"
