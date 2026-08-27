# Campus Gate Pass — Multi-Gate Digital Visitor Management System

> 📌 **New here? Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) first** — it's the current,
> complete source of truth (stack, DB, APIs, roles, business rules, how to run, gotchas).
> The sections below describe the original Phase-1 prototype and are **partly outdated**: the
> app now has a full backend (Prisma + Neon + NextAuth), so it is no longer "frontend-only"
> and no longer stores state in the browser.

A mobile-first, frontend-only prototype that replaces paper registers at university
gates with a digital check-in flow and a guard console. Built to prove out the UX and
cross-gate logic before any backend exists — every "API call" is a simulated async
action and all state lives in the browser.

> **No backend.** Data is kept in `localStorage` and synced across tabs via the
> browser `storage` event, which stands in for a shared server and demonstrates
> cross-gate visibility.

---

## The problem it solves

The campus runs 4 gates on paper registers, which means:

- **No cross-gate visibility** — a visitor who enters at Gate 1 and leaves at Gate 2 is untracked.
- **Slow queues** — manual writing at the gate.
- **No digital tooling** — guards can't approve, reject, escalate, or track who is still inside.

## Interfaces

| Interface | Route | For | Purpose |
|---|---|---|---|
| **Visitor check-in** | `/register?gate=<n>` | Visitor's phone (opened via a per-gate QR) | Pick a category, fill a dynamic form, take a live selfie, get a Reference ID |
| **Guard console** | `/guard` | Guard's tablet/phone | Live pending queue with Approve / Reject / Escalate, plus search active visitors to mark cross-gate exits |
| **Staff portal** | `/staff` | Signed-in staff | Backend-connected staff console |
| **Faculty parking portal** | `/faculty` | Signed-in faculty | Parking eligibility, registered vehicles, lot availability, and remote barrier open / QR scan |

---

## Features

### Visitor intake (`/register`)
- Reads the `?gate=` URL parameter (simulates scanning that gate's QR).
- **8 visitor categories**, each with its own dynamic fields:
  Parent, Delivery / Vendor, Taxi, Contractor, Official, Staff, Resident, Others.
- **Conditional fields** — e.g. for a **Parent**, *Hostel Name* is optional unless the
  *Purpose* is **Pickup**, in which case it becomes required (driven by a generic
  `requiredWhen` rule, not hard-coded).
- **Native browser selfie** using `getUserMedia` + `<video>`/`<canvas>` — no third-party
  camera library. Front camera, mirrored preview, center-cropped 640×640 JPEG, and the
  camera stream is released the instant a photo is taken or the component unmounts
  (turns the LED off, saves battery).
- Inline validation (required, format patterns, `maxLength`, mandatory photo) and a
  success screen with a unique **Reference ID** (`VMS-XXXXX`).

### Guard console (`/guard`)
- Lightweight sign-in where the guard selects the gate they are manning (this also
  becomes the exit gate).
- High-contrast dark header with a live "•" indicator, tuned for outdoor readability.
- **Pending queue** — cards with large Approve / Reject / Escalate touch targets and a
  tap-to-open detail sheet showing the selfie and every submitted field.
- **Active visitors** — search by name / phone / vehicle / reference ID, then **Mark
  exit** at the current gate. A **"Cross-gate exit"** badge appears when the visitor
  entered through a *different* gate — the core problem this system fixes.
- **Real entry time** — when a guard approves, the exact time is stamped and shown as
  both wall-clock and relative age (e.g. *"Entered 2:45 PM · 38m ago"*), refreshed live.

### Faculty parking portal (`/faculty`)

A backend-connected portal for faculty parking, served under `/faculty` (currently
sharing the staff console UI). All routes require a signed-in session and enforce a
same-origin check.

| Route | Method | Purpose |
|---|---|---|
| `/api/faculty/dashboard` | `GET` | Faculty profile + parking eligibility |
| `/api/faculty/lots` | `GET` | Active parking lots with capacity / occupancy (seeds defaults if empty) |
| `/api/faculty/vehicles` | `GET` / `POST` | List or register the faculty member's vehicles |
| `/api/faculty/vehicles/[id]` | `DELETE` | Remove a vehicle (owner or `HEAD` only) |
| `/api/faculty/profile` | `PATCH` | Update name, department, phone, alternate contact |
| `/api/faculty/barrier/open` | `POST` | Remotely open a gate barrier (parking-eligibility gated) |
| `/api/faculty/barrier/scan-qr` | `POST` | Open a barrier by scanning a gate QR |

---

## Tech stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** (vanilla utilities — no MUI/Chakra)
- **React** `useState` / `useContext` for all state
- **lucide-react** for icons

## Project structure

```
app/
  layout.tsx        Root layout, mobile viewport, wraps VisitorProvider
  globals.css       Tailwind + mobile base (16px inputs, no tap highlight)
  page.tsx          Landing hub → links to each gate and the guard console
  register/page.tsx Visitor intake (category → dynamic form + selfie → success)
  guard/page.tsx    Guard console (pending queue + active-visitor exit search)
  staff/page.tsx    Staff portal (backend-connected console)
  faculty/page.tsx  Faculty parking portal (reuses the staff console UI)
  api/faculty/      Faculty parking API (dashboard, lots, vehicles, profile, barrier)
components/
  CameraCapture.tsx Native getUserMedia selfie capture
lib/
  types.ts          Domain types (Visitor, CategoryConfig, FormField, …)
  categories.ts     Dynamic per-category form field config + getCategory()
  icons.ts          Category → lucide icon map (explicit, bundle-friendly)
  store.tsx         VisitorProvider context: localStorage + mock async + live sync
  security.ts       Input sanitisation, schema-guarded parsing, secure ref IDs
```

---

## Running it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Best demo: open `/register?gate=1` in one tab and
`/guard` in another — a submission appears live in the guard's queue.

### Testing on your phone (same Wi-Fi)

The selfie camera requires a **secure context** (HTTPS or `localhost`), so over the LAN
you must use HTTPS. Generate a self-signed cert once and start the dev server with it:

```bash
mkdir -p certificates
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certificates/key.pem -out certificates/cert.pem -days 365 \
  -subj "/CN=<your-laptop-ip>" \
  -addext "subjectAltName=IP:<your-laptop-ip>,IP:127.0.0.1,DNS:localhost"

npx next dev -H 0.0.0.0 -p 3000 --experimental-https \
  --experimental-https-key ./certificates/key.pem \
  --experimental-https-cert ./certificates/cert.pem
```

Then browse to `https://<your-laptop-ip>:3000` on your phone and accept the
"connection is not private" warning (expected for a self-signed cert on your own
network: **Show Details → visit this website** on iOS, **Advanced → Proceed** on
Android). If the phone can't reach it, check the macOS firewall and that both devices
are on the same (non-guest) network.

---

## Security & hardening

Even without a backend, all locally-held and rendered data is treated as untrusted:

- **XSS defence** — React escapes by default; `sanitizeInput` additionally strips HTML
  tags and escapes special characters on every stored field.
- **Schema-guarded storage** — `safeParseVisitors` validates every record read from
  `localStorage` (types, category/status unions, selfie format) and drops anything
  malformed, so local tampering can't corrupt state or inject markup.
- **Selfie validation** — only `data:image/jpeg;base64,...` payloads are accepted, with
  a ~3 MB cap to protect device memory.
- **Input limits** — `maxLength` and format patterns are enforced on the inputs
  themselves, not just in config.
- **Secure Reference IDs** — generated with Web Crypto (`getRandomValues`) over a
  32-char alphabet; 256 is an exact multiple of 32 so there is no modulo bias, and no
  Node `crypto` polyfill is pulled into the browser bundle.

## Notes / limitations (prototype)

- State is per-browser `localStorage`; a true two-device live demo shares only within
  the same browser. Clearing site data reseeds the demo visitors.
- Guard "sign-in" is a local gate selector, not real authentication.
- No persistence beyond the browser and no real network layer.
