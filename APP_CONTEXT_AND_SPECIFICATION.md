# 🏛️ Thapar University — Campus Visitor, Staff & Smart Parking System
## Complete System Architecture, Role Hierarchy, Technical Specification & Context

> **Last Updated:** August 2026  
> **Repository:** `https://github.com/Pranjal02garg/combined_vistor_parking.git`  
> **Architecture:** Next.js 15 Full-Stack Web + React Native Expo SDK 54 Native Mobile App + Prisma Database Engine

---

## 📑 Table of Contents
1. [Executive Overview](#1-executive-overview)
2. [Target Device Matrix & Platform Architecture](#2-target-device-matrix--platform-architecture)
3. [User Roles & Permission Hierarchy](#3-user-roles--permission-hierarchy)
4. [The 4 Core Staff & Resident Modules](#4-the-4-core-staff--resident-modules)
5. [End-to-End Workflow Flowcharts](#5-end-to-end-workflow-flowcharts)
6. [Gate Guard Console & Fast-Lane Verification](#6-gate-guard-console--fast-lane-verification)
7. [Head Admin Executive Command Center](#7-head-admin-executive-command-center)
8. [Public Visitor Intake & Dynamic Digital Pass](#8-public-visitor-intake--dynamic-digital-pass)
9. [Database Schema & Entity Relationship](#9-database-schema--entity-relationship)
10. [REST API Directory & Endpoints](#10-rest-api-directory--endpoints)
11. [Quick Demo Credentials & Deployment Runbook](#11-quick-demo-credentials--deployment-runbook)

---

## 1. Executive Overview

The **Thapar Campus Management Ecosystem** is an integrated campus security, pre-authorized guest intake, domestic staff clearance, and automated ANPR parking access platform.

### Core Problems Solved:
1. **Gate Congestion**: Replaced manual visitor paper logbooks with automated Fast-Lane ANPR and 1-scan QR entry (under 3 seconds per vehicle).
2. **Resident Autonomy**: Faculty and residents self-issue pre-cleared guest passes and register household domestic staff directly from their phones.
3. **Domestic Staff Vetting & Multi-Home Employment**: Solved the complex multi-quarter maid tracking problem with a **10-digit mobile auto-linking engine** and central police/Head verification.
4. **Parking Zone Integrity**: Real-time occupancy tracking for faculty zones (S4, ADMIN, E4) with color-coded sticker allowlists (`GREEN`, `BLUE`, `RED`).

---

## 2. Target Device Matrix & Platform Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   UNIFIED BACKEND & PRISMA DATABASE                   │
│           (PostgreSQL / SQLite · NextAuth · Argon2 · Mobile JWT)       │
└───────┬─────────────────┬───────────────────┬──────────────────┬───────┘
        │                 │                   │                  │
        ▼                 ▼                   ▼                  ▼
┌──────────────┐  ┌──────────────┐   ┌─────────────────┐  ┌──────────────┐
│  STAFF APP   │  │ GUARD KIOSK  │   │  VISITOR INTAKE │  │  HEAD ADMIN  │
│ Phone Native │  │ Tablet/iPad  │   │ Responsive Web  │  │ Desktop Web  │
│ (iOS/Android)│  │ (/guard)     │   │ (/register)     │  │ (/head)      │
└──────────────┘  └──────────────┘   └─────────────────┘  └──────────────┘
```

| Portal / App | Target Device | Technology Stack | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **Faculty & Resident Hub** | **iPhone & Android Phones** | React Native (Expo SDK 54) + Web (`/staff`) | 1-Tap barrier pulse, guest pass issuing, maid registration with ID uploads, vehicle allowlists. |
| **Gate Guard Console** | **Tablets / iPads / Kiosks** | Next.js 15 Web (`/guard`) | Numeric PIN login, 1-scan check-in/out, overstay alerts, live camera barcode scanning. |
| **Public Visitor Intake** | **Mobile & Desktop Web** | Next.js 15 Web (`/register` & `/pass/[token]`) | Selfie camera intake, OTP verification, dynamic anti-tamper watermark pass. |
| **Head Admin Center** | **Desktop Web Hub** | Next.js 15 Web (`/head`) | Executive analytics, physical camera alarm toggle, parking capacity controls, Excel batch allowlists. |

---

## 3. User Roles & Permission Hierarchy

| Role | Access Level | Gate Scoped? | Core Responsibilities |
| :--- | :--- | :--- | :--- |
| **`HEAD`** | **Campus-Wide Supreme** | ❌ No (All Gates) | Approves VIP passes, clears domestic staff registrations, files security incident notices, toggles physical sirens, executive analytics, Excel batch imports. |
| **`GUARD`** | **Gate Booth Operator** | ✅ Yes (Gate 1–4) | Numeric PIN shift login, scans guest passes & helper QR codes, validates visitor identity photos, opens barriers, handles overstay alerts. |
| **`STAFF`** | **Faculty / Campus Resident** | ❌ No (Residence) | 1-Tap barrier pulse, issues guest passes, registers household maids with Aadhaar uploads, links registered campus vehicles. |
| **`VISITOR`** | **Public Walk-in** | ❌ Self-Service | Pre-registers via web form, submits selfie photo, validates OTP, presents digital QR pass at gates. |

---

## 4. The 4 Core Staff & Resident Modules

The Staff Portal (`app/staff/page.tsx` and `staff-mobile-app`) is structured into **4 unified tabs**:

### 🚗 Tab 1: Parking & Gate Access
* **Faculty Profile Banner**: Live `● PERMIT ACTIVE` badge, Fast-Lane ANPR Ready status, Faculty ID (`#FAC-4092`), department, and validity window.
* **1-Tap Direct Barrier Remote Pulse**: Instant hardware relay trigger for Gates 1–4 with live 12-second opening pulse countdown.
* **Interactive Gate QR Scanner Modal**: Real-time camera viewfinder to scan physical barrier QR codes mounted at gate posts.
* **Registered Vehicles Management**: Monospace license plates (`PB11BH8820`), sticker tiers (`Green S4`, `Blue E4`, `Red`), **Vehicle Digital Security Badge QR Modal** with `PassShareBox` toolkit, and `+ Register Vehicle Modal` (with RC document upload).
* **Live Campus Parking Zones Availability Meter**: Real-time occupancy meters with color-coded capacity bars for Lots S4, ADMIN, and E4.

### 🎟️ Tab 2: Visitor & Guest Passes
* **Auto-Approved Guest Passes**: Pre-cleared passes with direct guard access.
* **`CreatePassModal`**: Guest Name, optional 10-digit mobile number, purpose category (`PERSONAL` vs. `OFFICIAL`), vehicle license plate, full-day validity date range.
* **`PassCard` & High-Contrast White `QRModal`**: High-resolution scannable QR pass with token code and full `PassShareBox` toolkit.

### 🧹 Tab 3: House Helps & Domestic Staff
* **10-Digit Mobile Auto-Linking Engine**: Entering an existing campus mobile number instantly links the helper without requiring re-approval.
* **`AddHouseHelpModal`**: Full name, mobile number, service category (`MAID`, `COOK`, `DRIVER`, `CLEANER`, `GARDENER`, `OTHER`), quarter number, shift time, government ID proof type (`AADHAAR`, `VOTER_ID`, `DRIVING_LICENSE`, `PASSPORT`, `OTHER`), ID number, **Aadhaar/ID document scan upload ($\le 5\text{MB}$ with preview)**, **helper face photo/selfie upload ($\le 5\text{MB}$ with preview)**, and validity expiration date.
* **`HouseHelpCard`**: Avatar initials/photo, service badge, phone link, quarter badge, verified government ID proof number, **inline validity extension date editor**, active/paused toggle (`isActive`), and unlinking with confirmation.
* **High-Contrast White `HouseHelpQRModal`**: Permanent Master Security Pass with `PassShareBox`.

### ⚠️ Tab 4: Security Notices & Residence Log
* Scoped incident notices filed by HEAD against the faculty quarter with severity badges (`CRITICAL`, `HIGH`, `LOW/MEDIUM`) and green resolution blocks.

### 🛠️ Shared `PassShareBox` Toolkit (Integrated across all QR Modals):
* **WhatsApp Direct Share**: Formatted `https://wa.me/{phone}?text=...` message with digital pass link.
* **Share QR Image**: Uses native mobile share sheet (`navigator.share({ files: [png] })` or React Native `Share.share`).
* **Copy PNG Image to Clipboard**: Direct `ClipboardItem` with PNG to paste into WhatsApp chats.
* **Copy Link**: `{origin}/pass/{token}`.
* **Save / Download PNG**: `Thapar-Gate-Pass-{token}.png`.

---

## 5. End-to-End Workflow Flowcharts

### 1. Guest / Visitor Pass Flowchart
```
┌────────────────────────────────────────┐
│ Option A: Staff Issues Pass (/staff)   │
│ (Faculty invites a guest/colleague)    │
└──────────────────┬─────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│  AUTO-APPROVED (Instant Clearance)     │
│  - Token generated: VIP-XXXXXXXX       │
│  - Digital Pass: /pass/{token}         │
│  - Faculty shares via WhatsApp / QR    │
└──────────────────┬─────────────────────┘
                   │
                   │ (Guest arrives at Campus Gate)
                   ▼
┌────────────────────────────────────────┐
│  GATE GUARD VERIFICATION (/guard)      │
│  1. Guard scans QR or ANPR reads plate │
│  2. Checks: Valid Date? Blacklisted?   │
│  3. Status: APPROVED ➔ CHECKED_IN      │
│  4. Gate Barrier opens (12s Pulse)     │
└──────────────────┬─────────────────────┘
                   │
                   │ (Guest leaves campus)
                   ▼
┌────────────────────────────────────────┐
│  GATE EXIT                             │
│  Guard logs Exit ➔ Status: EXITED      │
└────────────────────────────────────────┘
```

---

### 2. Domestic Staff / Maid Clearance Engine
```
Faculty enters Helper Mobile (10 digits) + Quarter + Aadhaar Doc + Selfie Photo on /staff
                                       │
                                       ▼
                    Does helper's phone already exist in campus database?
                                       │
                     ┌─────────────────┴─────────────────┐
                     ▼                                   ▼
             [ NO: Brand New Maid ]              [ YES: Existing Helper ]
                     │                                   │
                     ▼                                   ▼
        Status: PENDING_APPROVAL                INSTANT MULTI-HOME LINK
        (Master QR is LOCKED)                   (Inherits Existing Clearance)
                     │                                   │
                     ▼                                   │
        HEAD OF SECURITY REVIEW (/head)                  │
        - Head inspects Aadhaar doc & selfie             │
        - Checks police clearance records                │
        - Head clicks "APPROVE"                          │
                     │                                   │
                     └─────────────────┬─────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │     CLEARANCE ACTIVE (APPROVED)   │
                     │  - Master Security QR unlocked    │
                     │  - Permanent Token: HLP-XXXXX     │
                     └─────────────────┬─────────────────┘
                                       │
                                       │ (Maid comes daily for work)
                                       ▼
                     ┌───────────────────────────────────┐
                     │    DAILY GATE ENTRY (/guard)      │
                     │  1. Guard scans Helper Master QR  │
                     │  2. Console displays photo &      │
                     │     authorized employer quarters  │
                     │  3. Guard logs CHECK-IN           │
                     │  4. Maid goes to assigned homes   │
                     └─────────────────┬─────────────────┘
                                       │
                                       │ (End of shift)
                                       ▼
                     ┌───────────────────────────────────┐
                     │    DAILY GATE EXIT (/guard)       │
                     │  Guard scans QR ➔ Logs CHECK-OUT  │
                     └───────────────────────────────────┘
```

---

## 6. Gate Guard Console & Fast-Lane Verification

* **Route**: `/guard` (Client-side Next.js app).
* **Target Device**: Touch Kiosk / Apple iPad / Android Tablet at Gate Booths.
* **Authentication**: 4-digit numeric keypad PIN login (`gate1@campus.edu` / `guard123`).
* **Active Tabs**:
  1. **Requests (Pending)**: Live queue of incoming visitors requiring guard review.
  2. **Inside (Currently Active)**: Real-time headcount of all visitors and helpers currently inside the campus perimeter with live minute counters.
  3. **Past (Completed Visits)**: Historical departure logs with exit gate stamps.
  4. **Scan (Universal Scanner)**: Hardware-accelerated optical camera viewfinder for QR codes & barcode passes with torch toggle and manual fallback.
* **Overstay Detection**: Automatically flags visitors remaining on campus $>120$ minutes with red high-visibility alert borders.
* **Audio Alerts**: Distinct positive chime on gate approval, alert siren for blacklisted/overstaying visitors.

---

## 7. Head Admin Executive Command Center

* **Route**: `/head` (Client-side Next.js app).
* **Audience**: Chief Security Officer, Campus Registrar, Estate Office.
* **Key Capabilities**:
  1. **Campus Executive Analytics**: Hourly gate throughput charts, active visitor counts, vehicle distribution.
  2. **Physical Camera Siren Toggle**: Live manual control to trigger/silence physical ANPR camera alarm sirens across Gates 1–4.
  3. **Parking Zones & Lot Capacity**: Configure slot allocation, reserve slots, monitor overflow.
  4. **Allowlist & User Directory**: Color sticker tier filters (`GREEN`, `BLUE`, `RED`), instant permit suspension/activation.
  5. **Excel Batch Import**: Bulk import faculty vehicles and allowlists via `.xlsx` / `.csv` upload.
  6. **Domestic Staff Vetting Queue**: Review uploaded Aadhaar documents and selfies before unlocking Master QR passes.
  7. **Security Incident Logging**: File official residence notices and warnings against quarters.

---

## 8. Public Visitor Intake & Dynamic Digital Pass

* **Intake Route**: `/register`
* **Digital Pass Route**: `/pass/[token]`
* **Features**:
  * Clean mobile-responsive intake form for visitors scanning gate QR posters.
  * Live camera selfie capture with auto-cropping.
  * WhatsApp / SMS OTP verification.
  * **Dynamic Anti-Tamper Watermark**: Animated pulsing background canvas on the digital pass prevents screenshot sharing and fraud.
  * Real-time validity countdown timer.

---

## 9. Database Schema & Entity Relationship

```prisma
// Core Prisma Models Summary
model User {
  id              String         @id @default(cuid())
  email           String         @unique
  passwordHash    String
  name            String
  role            Role           @default(STAFF) // HEAD, GUARD, STAFF
  facultyId       String?
  department      String?
  quarterNumber   String?
  parkingEligible Boolean        @default(true)
  gateIds         String?        // For GUARD role
  vipPasses       VIPPass[]
  houseHelps      StaffHouseHelp[]
  vehicles        VehicleAllowlist[]
  notices         IncidentNotice[]
}

model VIPPass {
  id            String    @id @default(cuid())
  token         String    @unique // VIP-XXXXX
  guestName     String
  guestPhone    String?
  purpose       String?
  visitType     String    @default("OFFICIAL") // OFFICIAL, PERSONAL
  vehicleNumber String?
  validFrom     DateTime  @default(now())
  validUntil    DateTime
  status        VIPStatus @default(APPROVED) // PENDING, APPROVED, CHECKED_IN, EXITED, REJECTED
  creatorId     String
  creator       User      @relation(fields: [creatorId], references: [id])
}

model HouseHelp {
  id             String           @id @default(cuid())
  phone          String           @unique
  name           String
  serviceType    String           // MAID, COOK, DRIVER, CLEANER, GARDENER, OTHER
  token          String           @unique // HLP-XXXXX
  idProofType    String?          // AADHAAR, VOTER_ID, DRIVING_LICENSE, PASSPORT
  idProofNumber  String?
  idProofDocUrl  String?          // Base64 or Cloud URI
  photoUrl       String?          // Base64 or Cloud URI
  status         HouseHelpStatus  @default(PENDING_APPROVAL) // PENDING_APPROVAL, APPROVED, REJECTED
  policeVerified Boolean          @default(false)
  staffLinks     StaffHouseHelp[]
  logs           HouseHelpLog[]
}

model StaffHouseHelp {
  id            String    @id @default(cuid())
  staffId       String
  houseHelpId   String
  quarterNumber String
  workShift     String?
  validUntil    DateTime?
  isActive      Boolean   @default(true)
  staff         User      @relation(fields: [staffId], references: [id])
  houseHelp     HouseHelp @relation(fields: [houseHelpId], references: [id])
}

model VehicleAllowlist {
  id           String      @id @default(cuid())
  plateNumber  String      @unique
  ownerName    String
  ownerPhone   String?
  stickerColor String      // green, blue, red
  vehicleType  VehicleType @default(CAR)
  rcDocUrl     String?
  isActive     Boolean     @default(true)
  userId       String?
  user         User?       @relation(fields: [userId], references: [id])
}

model ParkingLot {
  id            String   @id @default(cuid())
  code          String   @unique // S4, ADMIN, E4
  name          String
  totalCapacity Int
  occupied      Int      @default(0)
  reservedSlots Int      @default(0)
}
```

---

## 10. REST API Directory & Endpoints

### 🔐 Authentication & Session
* `POST /api/auth/login` — Sign in with credentials (returns JWT session).
* `GET /api/auth/session` — Get authenticated user details and role permissions.
* `POST /api/auth/forgot-password` — Request password reset email.
* `POST /api/auth/reset-password` — Set new password with token.

### 🚗 Faculty & Smart Parking
* `GET /api/faculty/dashboard` — Live parking zone occupancies and registered vehicles.
* `GET /api/faculty/lots` — Parking lot capacity and free slot stats.
* `POST /api/faculty/vehicles` — Register a vehicle to the ANPR allowlist.
* `DELETE /api/faculty/vehicles/[id]` — Remove vehicle from allowlist.
* `POST /api/faculty/barrier/open` — 1-Tap remote gate barrier pulse.
* `POST /api/faculty/barrier/scan-qr` — Scan physical gate QR to open barrier.

### 🎟️ Guest Passes (VIP)
* `GET /api/vip` — List staff-issued VIP guest passes.
* `POST /api/vip` — Issue a new pre-approved guest pass.
* `POST /api/vip/checkin` — Guard check-in for guest pass.
* `POST /api/vip/exit` — Guard check-out for guest pass.
* `GET /api/vip/verify?token=...` — Public/Guard pass token lookup.

### 🧹 Domestic Staff & Maids
* `GET /api/staff/house-helps` — List domestic helpers linked to resident's quarter.
* `POST /api/staff/house-helps` — Register or auto-link domestic staff (with Aadhaar/photo uploads).
* `PATCH /api/staff/house-helps/[id]` — Pause/Activate or extend validity.
* `DELETE /api/staff/house-helps/[id]` — Unlink helper from quarter.

### 🛡️ Guard & Barrier Controls
* `GET /api/guard/feed` — Real-time live traffic feed (polled 5s).
* `GET /api/guard/lookup?q=...` — Instant barcode/plate lookup.
* `POST /api/guard/barrier` — Trigger physical barrier pulse relay.
* `POST /api/guard/house-help/action` — Domestic staff check-in / check-out.
* `POST /api/guard/ping` — Guard shift active heartbeat.

### 👑 Head Admin & Governance
* `GET /api/admin/analytics/gates` — Campus gate throughput analytics.
* `GET /api/admin/house-helps` — Domestic staff vetting queue.
* `POST /api/admin/house-helps/[id]/decision` — Approve / Reject helper clearance.
* `GET /api/admin/parking/lots` — Configure parking lot capacities.
* `POST /api/camera/event` — Honeywell ANPR camera trigger event.

---

## 11. Quick Demo Credentials & Deployment Runbook

### 🔑 Demo Accounts:

| Portal | Role | URL | Email | Password / PIN |
| :--- | :--- | :--- | :--- | :--- |
| **Faculty Portal** | `STAFF` | `/staff` | `staff1@campus.edu` | `staff123` |
| **Dean Portal** | `STAFF` | `/staff` | `prof.kaur@thapar.edu` | `staff123` |
| **Gate 1 Kiosk** | `GUARD` | `/guard` | `gate1@campus.edu` | `guard123` |
| **Gate 2 Kiosk** | `GUARD` | `/guard` | `gate2@campus.edu` | `guard123` |
| **Head Command** | `HEAD` | `/head` | `admin@campus.edu` | `admin123` |
| **Public Intake** | `VISITOR`| `/register` | Public Walk-in | N/A (OTP verified) |

---

### 🚀 Local Development Run Commands:

#### 1. Start the Full-Stack Web Platform (Port 3000):
```bash
cd visitor-management-system
npm run dev
# Accessible at http://localhost:3000
```

#### 2. Start the Native Mobile App (Expo):
```bash
cd staff-mobile-app
npx expo start -c
# Open in Expo Go on iOS / Android via exp://192.168.1.8:8081
```

#### 3. Build Standalone Mobile Packages (EAS):
```bash
cd staff-mobile-app
npm install -g eas-cli
eas build -p android --profile preview   # Downloadable APK
eas build -p ios --profile preview       # iOS Build
```
