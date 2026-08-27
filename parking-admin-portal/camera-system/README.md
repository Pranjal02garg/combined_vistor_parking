# 🅿️ Smart Parking System

> ANPR-based parking occupancy tracker with real-time kiosk display, powered by Honeywell cameras, MongoDB, and SQLite.

## What It Does

This system uses **Automatic Number Plate Recognition (ANPR)** cameras at parking lot entry and exit points to:

1. **Track occupancy** — Know exactly how many cars are inside at any moment
2. **Sync allowlists** — Push plate add/remove requests from a MongoDB queue to the cameras
3. **Display live status** — Full-screen kiosk showing available slots, occupancy grid, and recent activity

---

## Architecture

```
MongoDB ←──── plate_sync.py ────→ ANPR Cameras
                                       ↕
                              occupancy_tracker.py → parking.db → display_api.py → Kiosk Display
```

See [docs/architecture.md](docs/architecture.md) for a detailed data flow diagram.

---

## Project Structure

```
smart-parking/
├── src/                          # Python package — all backend logic
│   ├── config.py                 # Centralized configuration (reads .env)
│   ├── camera_client.py          # Shared Honeywell ANPR camera HTTP client
│   ├── plate_sync.py             # MongoDB → camera plate allowlist sync worker
│   ├── occupancy_tracker.py      # Dual-camera polling + SQLite occupancy store
│   ├── display_api.py            # Flask REST API for the kiosk display
│   └── jetson_server.py          # Alternative Jetson-specific backend
│
├── frontend/                     # Kiosk display UI
│   └── index.html                # Full-screen parking status dashboard
│
├── scripts/                      # Startup and utility scripts
│   ├── start_parking.bat/.sh     # Master startup (backend + API + kiosk)
│   ├── launch_kiosk.bat/.sh      # Launch Chrome/Chromium in kiosk mode
│   ├── change_ip.bat/.sh         # Update camera IPs in config.db
│   └── setup_autostart_jetson.sh # One-time autostart setup for Jetson
│
├── docs/                         # Documentation
│   └── architecture.md           # System architecture & data flow
│
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignore rules
├── requirements.txt              # Python dependencies
└── README.md                     # This file
```

---

## Prerequisites

- **Python 3.10+**
- **MongoDB Atlas** (or any MongoDB instance) — for plate allowlist sync
- **Honeywell ANPR cameras** — connected on the local network
- **Chrome / Chromium** — for kiosk display (optional, falls back to default browser)

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/smart-parking.git
cd smart-parking
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:

```env
MONGODB_URI=mongodb+srv://user:password@host/?appName=MyApp
CAM_HOST=192.168.1.2
CAM_USER=admin
CAM_PASS=admin
TOTAL_PARKING_SLOTS=100
```

### 4. Set camera IPs

```bash
# Windows
scripts\change_ip.bat 192.168.1.2 192.168.1.3

# Linux / Jetson
chmod +x scripts/change_ip.sh
./scripts/change_ip.sh 192.168.1.2 192.168.1.3
```

### 5. Run everything

```bash
# Windows — launches all services in separate windows
scripts\start_parking.bat

# Linux / Jetson
chmod +x scripts/start_parking.sh
./scripts/start_parking.sh
```

---

## Running Components Individually

Each component can be run standalone for development or debugging:

```bash
# Plate sync worker (MongoDB → camera allowlist)
python -m src.plate_sync

# Occupancy tracker (camera polling → parking.db)
python -m src.occupancy_tracker

# Display API (parking.db → REST endpoints)
python -m src.display_api

# Jetson server (alternative standalone backend)
python -m src.jetson_server
```

---

## Configuration Reference

All configuration is via environment variables (`.env` file):

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | *(required)* | MongoDB connection string |
| `CAM_HOST` | `192.168.1.2` | ANPR camera IP for plate sync |
| `CAM_USER` | `admin` | Camera login username |
| `CAM_PASS` | `admin` | Camera login password |
| `POLL_INTERVAL_SEC` | `3` | MongoDB poll interval (seconds) |
| `HEARTBEAT_INTERVAL_SEC` | `10` | Camera heartbeat interval (seconds) |
| `MAX_RETRIES` | `5` | Max retries before marking a plate sync as failed |
| `TOTAL_PARKING_SLOTS` | `100` | Total parking capacity |
| `DISPLAY_API_PORT` | `5055` | Port for the display REST API |
| `JETSON_SERVER_PORT` | `5000` | Port for the Jetson server |
| `CAM_DELETE_PATH` | `/API/AI/Plates/Remove` | Camera plate delete endpoint (unverified) |

---

## API Endpoints

### Display API (port 5055)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/status` | Live occupancy stats (occupied, available, total) |
| GET | `/api/recent?n=10` | Most recent N entries (max 50) |
| GET | `/api/health` | Server health check |

### Jetson Server (port 5000)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/plate/entry` | Register a vehicle entry `{"plate": "AB12CD3456"}` |
| POST | `/api/plate/exit` | Register a vehicle exit `{"plate": "AB12CD3456"}` |
| GET | `/api/status` | Full status with recent plates |
| GET | `/api/log?limit=50` | Vehicle history log |
| GET | `/api/health` | Server health check |

---

## Jetson Deployment

### Auto-start on boot

Run once on your Jetson:

```bash
chmod +x scripts/setup_autostart_jetson.sh
./scripts/setup_autostart_jetson.sh
```

This creates a `.desktop` autostart entry that launches the full system 10 seconds after login.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| `MONGODB_URI is EMPTY` | Check your `.env` file has `MONGODB_URI` set |
| `IP address(es) not configured` | Run `scripts/change_ip.bat` (Windows) or `scripts/change_ip.sh` (Linux) `<entry_ip> <exit_ip>` |
| Camera login fails with 401 | Verify `CAM_USER` and `CAM_PASS` in `.env` |
| Heartbeat failures | Camera requires heartbeat every 10s; check network connectivity |
| Display shows "System Offline" | Ensure `display_api.py` is running on port 5055 |
| `plate_sync` marks records as `failed` | Check `lastError` field in MongoDB; fix and clear `failed` flag |
| Kiosk won't go fullscreen | Click the display once, or check Chrome kiosk flags |

---

## Known Limitations

- **Delete endpoint is unverified** — The plate removal API path (`/API/AI/Plates/Remove`) is assumed by symmetry with the Add endpoint. Capture the real endpoint from the camera's web UI before relying on it in production.
- **Single-camera plate sync** — `plate_sync.py` syncs to one camera (`CAM_HOST`). For multi-camera sync, run multiple instances with different `.env` configs.

---

## License

This project is proprietary. Contact the maintainers for licensing information.
