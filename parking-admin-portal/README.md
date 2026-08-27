# 🅿️ Pilot-Parking – AI-Powered Distributed Smart Parking System | Funded: 6 Lakh | Live Production 2026
**Tech Stack**: FastAPI, PostgreSQL, Redis, AWS (ECS/RDS/ElastiCache/SQS/SNS/S3), YOLOv8, TrOCR, Docker, MQTT, React.js

**Pilot-Parking** is a comprehensive, production-grade "AI-everywhere" parking access management system. Instead of relying on pre-built AI cameras, **we built the AI pipeline from scratch**. The ecosystem integrates custom OCR models, automated gate barriers, a Next.js-powered Admin Portal, a distributed API backend for a mobile app, and a real-time kiosk dashboard. This project represents a fully funded, full self-deployment managed entirely by a 2-man team handling all infrastructure and development from scratch.

## 🚀 Key Highlights & Novelty
- **University-funded (6L) live campus deployment** – ANPR pipeline (YOLOv8 + TrOCR) reads number plates and opens physical barrier within sub-2 seconds, end-to-end.
- **Slot allocation engine**: min-heap + segment tree for O(log n) nearest-slot queries; Redis ElastiCache for O(1) real-time state reads; PostgreSQL for ACID booking transactions.
- **LLD**: Strategy pattern (flat/hourly/tiered pricing), Observer pattern (barrier events), clean OOP model – ParkingLot, Zone, Slot, Vehicle, Booking, Barrier.
- **Distributed AWS**: ECS (stateless API), RDS, ElastiCache, SQS (async queue), SNS/SES (alerts), S3 (ANPR archive), Docker + GitHub Actions CI/CD.

---

## 🌟 System Overview

```
                      +-------------------+
                      |   MongoDB Atlas   | <-------------------------+
                      +-------------------+                           |
                         |             ^                              |
        (Poll car_changes)             | (Log changes / self-service)  |
                         v             |                              v
               +------------------+  +---------------+        +----------------+
               |  plate_sync.py   |  | Next.js Admin |        | Expo Mobile    |
               +------------------+  | Web Portal &  |        | App (Self-     |
                   /          \      | Mobile API    |        | Service App)   |
                  v            v     +---------------+        +----------------+
            +--------+      +--------+       ^
            | Entry  |      | Exit   |       |
            | Camera |      | Camera |       |
            +--------+      +--------+       |
                 \              /            |
    (Video streams) \        / (Video streams)
                       v    v                |
            +----------------------+         |
            |   AI OCR Pipeline    |         |
            |   (YOLOv8 & TrOCR)   |         |
            +----------------------+         |
                       |                     |
                 (Poll events)               |
                       v                     |
            +----------------------+         |
            | occupancy_tracker.py |         |
            +----------------------+         |
                       |                     |
                (Writes to SQLite)           |
                       v                     |
              +------------------+           |
              |    parking.db    |           |
              +------------------+           |
                       |                     |
                 (Reads status)              |
                       v                     v
              +------------------+     +------------+
              |  display_api.py  | --> | Kiosk UI   |
              |     (Flask)      |     | index.html |
              +------------------+     +------------+
```

1. **Gate Barriers & Microcontrollers**: Ubuntu-based microcontrollers control the physical gate barriers. They can be triggered either automatically by ANPR matching or via QR code scans from the mobile application.
2. **Dual-Camera ANPR**: Standard entry and exit cameras feed raw video streams into our custom AI pipeline (we built the AI from scratch instead of relying on hardware-based AI cameras).
3. **AI OCR Pipeline**: Custom YOLOv8 and TrOCR models process the video streams for highly accurate plate reading, fuzzy matching, and filtering. Plate events are then polled to track current occupancy.
4. **Admin Web Portal (Next.js 16)**: Backed by MongoDB, the admin portal allows security personnel to register users, toggle active/inactive status, audit logs, and manage the camera allowlist.
5. **Mobile API Backend**: Next.js route handlers serve as a secure Bearer-token API for the Expo mobile app, allowing users (such as faculty) to manage their linked vehicles and scan QR codes to open gates.
6. **Kiosk Display**: A lightweight dashboard runs in Chrome/Chromium kiosk mode at the parking lot entrance, showing available slots, occupancy grids, and recent entry/exit history.

---

## 📂 Project Directory Structure

The project has been professionally organized into logical components:

```
ParkIn/
├── AI/                        # AI Experiments & Custom OCR Pipelines
│   ├── public-data-yolov8-easyocr.ipynb
│   ├── fine-tuned-self-captured-data-yolov8-easyocr.ipynb
│   ├── own-data-yolov8-trocr-fuzzy-matching-colour-filters.ipynb
│   └── own-data-finetuned-yolov8-trocr-production-cpu-optimized.py
│
├── camera-system/             # ANPR Camera & Kiosk System (Python)
│   ├── kiosk-display/         # Kiosk dashboard UI (HTML/JS)
│   │   └── index.html         # Live status screen
│   ├── scripts/               # Launcher and network configuration scripts
│   │   ├── change_ip.bat/.sh  # Update entry/exit camera IPs in config.db
│   │   ├── launch_kiosk.bat/.sh # Open Chrome in kiosk mode pointing to the display UI
│   │   ├── start_parking.bat/.sh # Master startup script for all camera backend modules
│   │   └── setup_autostart_jetson.sh # Jetson auto-boot daemon setup
│   ├── src/                   # Python background workers
│   │   ├── camera_client.py   # Honeywell ANPR camera API client wrapper
│   │   ├── config.py          # Central configurations and path resolutions
│   │   ├── display_api.py     # Flask REST API exposing sqlite parking.db to the kiosk
│   │   ├── jetson_server.py   # Jetson-specific hardware server
│   │   ├── occupancy_tracker.py # SQLite database writer (polls camera entry/exit events)
│   │   └── plate_sync.py      # MongoDB -> Honeywell ANPR plate list synchronizer
│   └── requirements.txt       # Camera system python dependencies
│
├── data/                      # Structured databases, exports, and assets
│   └── Car Parking details.xlsx # Master seed data sheet of faculty & vehicles
│
├── docs/                      # Global documentation, guides, and specifications
│   ├── guides/                # 9-part developer training & setup guides
│   ├── auth-implementation.md # Security details: Argon2id, rate limits, lockouts, CSRF
│   ├── camera-architecture.md # Technical documentation for the ANPR camera pipeline
│   └── next-changes.md        # Mobile backend API specifications and contracts
│
├── scripts/                   # Workspace-wide Node.js & python database utilities
│   ├── db-manager.py          # MongoDB CLI tool (fetch/delete users, sessions, audits)
│   ├── fix-db.js              # Script to migrate legacy database user roles
│   ├── import-parking-excel.js # Seed script importing records from data/Car Parking details.xlsx
│   └── mobile-api.integration.mjs # Next.js mobile endpoints integration suite
│
├── src/                       # Next.js 16 Admin Web App & Mobile API Backend (TypeScript)
│   ├── app/                   # App Router pages and API routes
│   │   ├── api/               # API endpoints (/api/auth, /api/mobile, /api/qr, etc.)
│   │   ├── dashboard/         # Protected web admin dashboard
│   │   ├── login/ / register/ # Auth pages
│   │   └── layout.tsx / page.tsx
│   ├── components/            # Reusable UI components
│   └── lib/                   # Database client, environment configuration, auth services
│
├── public/                    # Next.js static asset folder
├── package.json               # Next.js dependencies, scripts, and build details
├── tsconfig.json              # TypeScript compilation parameters
└── next.config.ts             # Next.js custom settings
```

---

## 🧠 AI Pipeline (YOLOv8 & TrOCR)

The `AI/` folder contains the training and OCR experiments used for the parking number plate project. It focuses on achieving high accuracy through custom fine-tuning and advanced matching.

### Pipeline Chapters / File Index

| File | Purpose |
| --- | --- |
| `public-data-yolov8-easyocr.ipynb` | Trains a YOLOv8 plate detector with public data and uses EasyOCR for plate reading. |
| `fine-tuned-self-captured-data-yolov8-easyocr.ipynb` | Fine-tunes the detector on self-captured data and runs the YOLOv8 + EasyOCR pipeline. |
| `own-data-yolov8-trocr-fuzzy-matching-colour-filters.ipynb` | Runs a more advanced plate-reading workflow with TrOCR, fuzzy matching, and color-based filters. |
| `own-data-finetuned-yolov8-trocr-production-cpu-optimized.py` | Production-oriented CPU-optimized script for the custom dataset and TrOCR pipeline. |

### Notes

- The filenames were normalized to lowercase, hyphen-separated names for easier GitHub browsing and sharing.
- No files under `data/` were changed.

---

## ⚙️ Environment Configuration

The codebase utilizes separate environment configurations for the Next.js web application and the Python camera system.

### 1. Web Portal & CLI Tools Configuration (`.env.local`)
Create a file named `.env.local` in the root folder (Next.js automatically loads it, and helper scripts are configured to use it as a fallback):

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/parking_app?appName=ParkIn
MONGODB_DB_NAME=parking_app
APP_ORIGIN=http://localhost:3000
```

### 2. Camera System Configuration (`camera-system/.env`)
Create a file named `.env` inside `/camera-system/`:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/parking_app?appName=ParkIn
CAM_HOST=192.168.1.2
CAM_USER=admin
CAM_PASS=admin
TOTAL_PARKING_SLOTS=100
DISPLAY_API_PORT=5055
```

---

## 🚀 Running the Project

### 💻 Starting the Web Admin Portal & Backend
1. Install project dependencies:
   ```bash
   npm install
   ```
2. Start the local server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 🧪 Executing Integration Tests
To test the Next.js Mobile API backend locally, shut down any running dev servers and run:
```bash
npm run test:mobile-api
```

### 📊 Seed Database from Excel
Import users and vehicle configurations from `data/Car Parking details.xlsx` into your MongoDB:
```bash
node scripts/import-parking-excel.js
```

### 🛠️ MongoDB Database Management CLI
Use `scripts/db-manager.py` (requires `pymongo` and `python-dotenv`) to manage database states:
```bash
# Fetch and print collections in a clean table format:
python scripts/db-manager.py fetch users
python scripts/db-manager.py fetch sessions
python scripts/db-manager.py fetch car_changes

# Wipe or clean up expired sessions:
python scripts/db-manager.py delete sessions --all
```

---

## 📸 Starting the Camera & Kiosk System

Before launching, configure camera IPs by providing the entry and exit camera IP addresses:

```bash
# On Windows:
camera-system\scripts\change_ip.bat 192.168.1.2 192.168.1.3

# On Ubuntu / Jetson:
chmod +x camera-system/scripts/change_ip.sh
./camera-system/scripts/change_ip.sh 192.168.1.2 192.168.1.3
```

### Run All Camera Services
Launch the occupancy tracker, Flask Display API, and Chromium kiosk dashboard simultaneously:

```bash
# On Windows:
camera-system\scripts\start_parking.bat

# On Ubuntu / Jetson:
chmod +x camera-system/scripts/start_parking.sh
./camera-system/scripts/start_parking.sh
```

---

## 📊 Database Schemas

### Next.js MongoDB Schema (Central Database)
- **`users`**: User identity, roles (`admin` / `user`), login lockout counters, and nested allowed vehicles list `allowedCars: [{ plateNumber: string, stickerColor: string }]`.
- **`sessions`**: Active login sessions.
- **`car_changes`**: Write-queue audit log. When an admin or user edits their allowlist, Next.js writes a change request (`{ "car number": "...", "action": "add" | "delete" }`). `plate_sync.py` polls this queue and provisions the cameras.

### Camera SQLite Schema (`camera-system/parking.db` — Occupancy)
- **`cars_inside`**: Holds vehicles currently parsed inside the lot to calculate live capacity.
  - `snap_id` (TEXT PK): Plate/snapshot identifier.
  - `grp_id` (INTEGER): Group status (1 = allowed, 2 = blocked).
  - `entered` (TEXT): ISO timestamp of entry.

### Configuration SQLite Schema (`camera-system/config.db`)
- **`cameras`**: Stores entry/exit hardware bindings.
  - `role` (TEXT PK): 'entry' or 'exit'.
  - `ip` (TEXT): Camera IP address.

---

## 📄 License & Documentation
For advanced setups, security configurations, and guide checklists, please refer to the files in the [/docs](file:///c:/Users/User/Desktop/projects/Admin-portal/docs) folder.
