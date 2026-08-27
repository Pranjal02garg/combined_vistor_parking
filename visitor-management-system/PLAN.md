# Implementation Plan — Campus Gate Pass (VMS Frontend)

## Context

The university runs 4 gates on paper registers: no cross-gate visibility, slow queues,
and no digital tooling for guards. This project is a **frontend-only** prototype (no
backend) that proves the UX and the cross-gate logic. All "API" calls are simulated with
`setTimeout` promises; state lives in React + `localStorage`. Two interfaces: a
mobile visitor intake form and a guard console.

**Stack (fixed):** Next.js 15 (App Router) · TypeScript · Tailwind CSS (vanilla
utilities) · React `useState`/`useContext` · `lucide-react` icons.

---

## Architecture

```
Visitor phone  ──submit──▶  localStorage (STORAGE_KEY = "vms.visitors")
                                 │  storage event (cross-tab live sync)
                                 ▼
Guard tablet   ◀──live queue── VisitorProvider (React Context)
               ──approve/reject/exit──▶ localStorage
```

- **`lib/store.tsx`** — `VisitorProvider` context is the single source of truth. It
  hydrates from `localStorage`, seeds demo data on first load, listens for the browser
  `storage` event (guard tab picks up the visitor tab's submissions), and exposes async
  actions wrapped in a 600 ms fake latency: `submitVisitor`, `decideVisitor`, `markExit`.
- **`lib/security.ts`** — all reads/writes pass through sanitisation + a schema guard so
  local tampering can't corrupt state or inject markup.

---

## Data model (`lib/types.ts`)

- `VisitorCategory` — `parent | delivery_vendor | taxi | contractor | official | staff |
  resident | others`.
- `VisitorStatus` — `pending | approved | rejected | escalated | exited`.
- `FormField` — `{ name, label, type, required, placeholder?, options?, pattern?,
  maxLength?, requiredWhen? }`. `requiredWhen: { field, value }` drives conditional
  requirements generically.
- `Visitor` — full record incl. `referenceId`, `fieldValues`, `selfie` (base64),
  `entryGate`, `exitGate?`, `createdAt`, `enteredAt?` (stamped on approval), and hoisted
  `phone` / `vehicleNumber` for fast guard search.

## Dynamic form config (`lib/categories.ts`)

`CATEGORIES: CategoryConfig[]` — shared base fields (Name, Phone) spread into each
category plus category-specific fields. `getCategory(id)` helper.

| Category | Fields (beyond Name + Phone) |
|---|---|
| **Parent** | Student Name, Purpose (select), Hostel Name *(required only when Purpose = Pickup)* |
| **Delivery / Vendor** | Company, Purpose (**select**), Delivery To / Person to Meet, Vehicle (optional) |
| **Taxi** | Vehicle, Passenger Name, Drop/Pickup Point |
| **Contractor** | Company, Work Order/Pass No, Site/Block, Vehicle, No. of Workers |
| **Official** | Organisation, Designation, Purpose, Person/Dept to Meet, Vehicle (optional) |
| **Staff** | Employee ID, Department, Vehicle (optional) |
| **Resident** | Resident Type (select), Block/Flat No, ID/Pass No, Vehicle (optional) |
| **Others** | Purpose, Person/Place to Meet, Vehicle (optional) |

---

## Components & pages

### `components/CameraCapture.tsx`
Native `getUserMedia` selfie. Front camera, mirrored square preview, center-cropped
640×640 JPEG via `<canvas>`. State machine `idle → requesting → live → captured → error`.
Releases all tracks on capture and unmount (LED off / battery). Handles insecure-context,
permission-denied, and no-camera cases; pauses/resumes on tab visibility change.

### `app/register/page.tsx` (Steps: category → details → success)
- Reads `?gate=`; category picker grid; renders dynamic `Field`s from config.
- `isRequired(field)` resolves `required` **or** a satisfied `requiredWhen`; the asterisk
  and "(optional)" hint update live. Validation anchors patterns safely and enforces
  `maxLength`; selfie is mandatory. Success screen shows the Reference ID.

### `app/guard/page.tsx`
- Gate sign-in → console with **Pending queue** and **Active visitors** tabs.
- Queue cards: large Approve / Reject / Escalate; tap opens a detail sheet with the
  selfie + all fields.
- Active tab: search (name/phone/vehicle/ref), **Mark exit** at current gate,
  **Cross-gate exit** badge when `entryGate !== guard gate`, and the real entry time
  (absolute + relative, refreshed via a 30 s tick).

---

## Security decisions

- Sanitise + tag-strip every stored field; React escaping on render.
- `safeParseVisitors` validates each `localStorage` record against the schema and the
  category/status unions — **must stay in sync with `VisitorCategory`** or new-category
  visitors get dropped on reload.
- Selfie accepted only as `data:image/jpeg;base64,…`, capped ~3 MB.
- Reference IDs from Web Crypto (`getRandomValues`), 32-char alphabet, no modulo bias, no
  Node `crypto` polyfill in the client bundle.

## Verification

- `npx tsc --noEmit` — clean.
- `npx next build` — all routes compile; register ≈115 kB / guard ≈118 kB First Load JS.
- Manual: submit on `/register?gate=1` → appears in `/guard` queue → Approve → switch to
  Active, sign in as a different gate → "Cross-gate exit" badge → Mark exit.
- On-phone over LAN via HTTPS self-signed cert (see README) to validate mobile layout and
  the native camera.

## Build order (completed)

1. Scaffold (Next.js 15, Tailwind, layout, landing).
2. Types + category config.
3. `CameraCapture` component.
4. Shared mock store + security layer.
5. Visitor intake form.
6. Guard dashboard.
7. Iteration: student name + conditional hostel; merged Delivery/Vendor with select
   purpose; added "Others"; guard entry-time; security & bundle hardening.
