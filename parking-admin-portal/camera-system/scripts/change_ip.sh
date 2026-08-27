#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
#  change_ip.sh  —  Update camera IPs in config.db for Linux/Ubuntu/Jetson
# ═══════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DB="$SCRIPT_DIR/../config.db"

if [ "$#" -ne 2 ]; then
    echo ""
    echo "Usage:   $(basename "$0") <entry_ip> <exit_ip>"
    echo ""
    echo "  entry_ip   IP address of the ENTRY camera"
    echo "  exit_ip    IP address of the EXIT  camera"
    echo ""
    echo "Example: $(basename "$0") 192.168.1.2 192.168.1.3"
    echo ""
    exit 1
fi

ENTRY_IP="$1"
EXIT_IP="$2"

if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "ERROR: sqlite3 not found."
    echo "Please install sqlite3 (e.g., 'sudo apt-get install sqlite3') and try again."
    exit 1
fi

sqlite3 "$CONFIG_DB" <<EOF
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
CREATE TABLE IF NOT EXISTS cameras (role TEXT PRIMARY KEY, ip TEXT NOT NULL);
INSERT INTO cameras (role, ip) VALUES ('entry', '$ENTRY_IP') ON CONFLICT(role) DO UPDATE SET ip = excluded.ip;
INSERT INTO cameras (role, ip) VALUES ('exit', '$EXIT_IP') ON CONFLICT(role) DO UPDATE SET ip = excluded.ip;
EOF

if [ $? -ne 0 ]; then
    echo "ERROR: sqlite3 returned an error."
    exit 1
fi

echo ""
echo "config.db updated:"
echo "  entry camera -> $ENTRY_IP"
echo "  exit  camera -> $EXIT_IP"
echo ""
echo "Restart the occupancy tracker for the new IPs to take effect."
exit 0
