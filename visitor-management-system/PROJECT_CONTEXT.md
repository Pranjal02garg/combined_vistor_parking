# Campus Gate Pass — Full Project Context (Handoff)

> **Purpose of this file:** a complete, self-contained briefing so a new chat/developer can
> pick up this project with zero prior context. Read this top-to-bottom before making changes.
> Last updated: 2026-07-02.

---

## 1. What this is
A **Multi-Gate Digital Visitor Management System (VMS)** for a university campus with 4 gates.
It replaces paper registers with:
- A **public mobile intake form** (visitors self-register via a per-gate QR → pick a category,
  fill a dynamic form, take a selfie, get a reference code + QR).
- A **Guard console** (approve/reject entries, mark exits, scan QR passes).
- A **STAFF portal** (issue "VIP passes" for guests).
- A **HEAD/Admin command center** (analytics, VIP approvals, full edit/CRUD, form builder,
  blacklist, settings).

It was built in phases 1→4. **All four phases are complete, type-checks clean, builds clean,
and are verified end-to-end against a live database.**x

---

## 2. Tech stack & infrastructure
- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS** + **lucide-react** icons.
- **Prisma 6** ORM (⚠ pinned to 6 — **do NOT upgrade to Prisma 7**, which removes in-schema
  `url`/`directUrl` and needs a driver-adapter rewrite).
- **PostgreSQL on Neon** (Vercel-compatible for now, designed to be easily Dockerized for AWS RDS later).
- **NextAuth v5** (`next-auth@beta`) — Credentials provider, **JWT sessions** (no adapter tables).
- **@tanstack/react-query** for client data fetching/polling.
- **Vercel Blob** (`@vercel/blob`) for selfie storage — **currently DISABLED** (token commented
  out in `.env`), so selfies fall back to local disk `public/uploads/` in dev. (Easily swappable to AWS S3 via Docker later).
- **Upstash Redis** (`@upstash/ratelimit`) for rate limiting (configured).
- **@node-rs/argon2** for password hashing (Argon2id), **sharp** for server-side image
  re-encode, **qrcode** for QR generation.

### Environment variables (`.env`, git-ignored; template in `.env.example`)
`DATABASE_URL` (Neon pooled), `DIRECT_URL` (Neon direct, for migrations),
`BLOB_READ_WRITE_TOKEN` (currently commented out → local-disk selfies),
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `AUTH_SECRET` (currently a dev
placeholder — **rotate for production**). Real Neon/Upstash creds are already in the local `.env`.

---

## 3. How to run
```bash
npm install
npx prisma generate
npx prisma migrate deploy      # apply migrations to the DB in .env
npm run db:seed                # gates + demo users + form config + settings
npm run dev                    # http://localhost:3000

# Phone testing over LAN (HTTPS required for the camera). Regenerate cert for your current IP:
mkdir -p certificates
openssl req -x509 -newkey rsa:2048 -nodes -keyout certificates/key.pem -out certificates/cert.pem \
  -days 365 -subj "/CN=<LAN-IP>" -addext "subjectAltName=IP:<LAN-IP>,IP:127.0.0.1,DNS:localhost"
npx next dev -H 0.0.0.0 -p 3000 --experimental-https \
  --experimental-https-key ./certificates/key.pem --experimental-https-cert ./certificates/cert.pem
# then open https://<LAN-IP>:3000 on the phone and accept the self-signed cert warning.
```

### Demo accounts (from `prisma/seed.ts`)
| Email | Password | Role | Gates |
|---|---|---|---|
| `admin@campus.edu` | `admin123` | HEAD | all |
| `staff1@campus.edu` | `staff123` | STAFF | — |
| `gate1@campus.edu` | `guard123` | GUARD | Gate 1 |
| `gate2@campus.edu` | `guard123` | GUARD | Gate 2 |
*(Note: Guard accounts are gate-specific, not tied to individual guards, for simplicity).*

Gates seeded: codes `"1".."4"`. Routes: `/` (landing), `/register?gate=<code>`, `/guard`,
`/head`, `/staff`. On sign-in, `/guard` auto-redirects STAFF→`/staff`, HEAD→`/head`.

---

## 4. Roles & permissions
`Role = HEAD | GUARD | STAFF` (the old `ADMIN/SUPERVISOR` were replaced).
- **HEAD** — absolute authority: analytics, approve/reject VIP passes, approve/reject/edit ANY
  record, generate passes directly (auto-approved), manage the dynamic form builder, blacklist,
  and system settings.
- **GUARD** — **campus-wide** operator (IDOR gate-scoping was intentionally relaxed): sees ALL
  pending + active traffic, approves/rejects standard entries, scans VIP/normal QR, marks exits.
  The "operating gate" selector only sets which gate is *stamped* on an entry/exit.
- **STAFF** (e.g., Teachers) — pre-fill details to create VIP passes for guests (which then need HEAD approval).

> ⚠ Naming overlap: `STAFF` is both a **Role** and a **VisitorCategory** ("staff" walk-in).
> Different concepts, different tables.

---

## 5. Data model (`prisma/schema.prisma`)
Enums: `Role`, `VisitStatus (PENDING/APPROVED/REJECTED/ESCALATED/EXITED)`,
`VIPPassStatus (PENDING/APPROVED/REJECTED/CHECKED_IN/EXITED/EXPIRED)`.
> Note: `VisitorCategory` is **no longer an enum** — categories are dynamic DB rows (Phase 4).
> `VisitLog.category` is a plain `String` storing the category `key`.

- **User** — staff accounts. `role`, `passwordHash` (argon2), many-to-many `gates`, VIP relations.
- **Gate** — `code` ("1".."4"), `name`, `location`, `staff`.
- **Visitor** — reusable identity deduped by unique `phone`; `overstayCount` (repeat-defaulter signal).
- **VisitLog** — one standard visit. Key fields: `referenceCode` (crypto, shown to visitor),
  `category` (string key), `categoryLabel` + `fieldsSnapshot` (write-time snapshot of the form
  for history-proof rendering), `details` (JSON values), `selfieUrl`, `status`, `vehicleNumber`
  (hoisted, indexed), `phoneVerified`, entry/exit gate + timestamps (`approvedAt`, `exitedAt`),
  `decidedById`/`exitedById`/`editedById`.
- **VIPPass** — staff-generated pass. `token` (crypto, in the QR), guest fields, `status`,
  `hostStaffId`, `approvedBy`, `scannedBy`, entry/exit gate + timestamps, `validFrom/validUntil`.
- **Dynamic form engine:** `FormCategory` (key/label/icon/sortOrder/`active`), `FormField`
  (name/label/type/required/pattern/maxLength/`requiredWhenField`+`requiredWhenValue`/`active`),
  `FieldOption` (value/label). **Soft-delete only** (`active=false`) to preserve history.
- **SystemSettings** — singleton row `id="global"`: `overstayMinutes` (default 120),
  `defaulterThreshold` (default 3), `featureFlags` (JSON).
- **Blacklist** — `phone` (unique), `reason`, `active`, `expiresAt` (null=permanent), `createdById`.

### Migrations (in order — history is clean & in sync)
1. `20260701090010_init` — Phase 2 base (User/Gate/Visitor/VisitLog).
2. `20260701170000_phase3_vip_roles_otp` — VIPPass, HEAD/GUARD/STAFF roles, phoneVerified.
3. `20260701202438_phase4_dynamic_forms_admin` — form engine, SystemSettings, Blacklist,
   overstayCount, `category` enum→text (hand-edited to cast in place & preserve data).

---

## 6. Key business rules (IMPORTANT — read before changing logic)
- **VIP two-step flow:** STAFF creates (PENDING) → **HEAD approves** (APPROVED) → **GUARD scans/
  checks in** at a gate (CHECKED_IN) → exit (EXITED). Guards CANNOT approve VIPs; HEAD does.
- **Overstay = live-computed** (`now − entry > SystemSettings.overstayMinutes`, default 120).
  Not a stored flag; computed on read. `Visitor.overstayCount` increments on exit-after-overstay.
  UI shows red border + "⚠ OVERSTAY (> 2 HRS)" and "Inside for Xh Ym".
- **Blacklist = warn-only** (by product decision): a blacklisted phone is NOT blocked at intake;
  it's flagged red in guard/HEAD feeds and the guard decides.
- **Dynamic forms + data integrity:** the intake form is DB-driven (not `lib/categories.ts` at
  runtime; that file is now only **seed data**). Deletes are soft (archive). Each VisitLog stores
  its own `fieldsSnapshot`, so old records render correctly even after a field/category is edited
  or archived. `POST /api/visits` validates dynamically via `lib/server/forms.ts`
  (`getCategoryConfig` + `validateAgainstConfig`).
- **Campus-wide guards:** the guard feed/actions are NOT gate-scoped (relaxed IDOR) — any signed-in
  guard sees & acts on all traffic. Auth is still enforced; only the gate boundary was removed.
- **OTP Verification:** EVERY visitor must verify their phone number via SMS OTP before submitting the form, ensuring all contacts are reachable later. If they arrive in a vehicle, the vehicle number is linked to this verified phone number. (Currently dummy code + HMAC token; will be real SMS later).
- **Caching:** guard/admin read routes use `export const dynamic = "force-dynamic"`; the client
  `request()` in `lib/api.ts` uses `cache: "no-store"`. The guard feed polls every 5s.

---

## 7. API reference (all under `app/api/`)
**Public:** `POST /api/visits` (dynamic-validated submit), `GET /api/config/forms` (form config),
`POST /api/otp/request`, `POST /api/otp/verify`, `GET|POST /api/auth/[...nextauth]`.

**Guard/HEAD:**
- `GET /api/guard/feed` — **unified master feed** (normal+VIP, active+pending), server-sorted
  (active first), each item carries `createdAt`, `fields[]`, `overstaying`, `minutesInside`,
  `blacklisted`. Powers the guard Live Traffic tab AND the HEAD "Live Traffic (All)" tab.
- `GET /api/guard/lookup?code=` — resolve a scanned `VIP-…` token or `VMS-…` reference → one card.
- `GET /api/gates` — all active gates (guards are campus-wide).
- `GET /api/visits/pending` (campus-wide), `GET /api/visits/active`, `GET /api/visits/search`,
  `GET /api/visits/queue?gateId=` (legacy gate-scoped), `GET /api/visits/escalated` (HEAD).
- `PATCH /api/visits/:id/decision` (approve/reject/escalate), `POST /api/visits/exit`.
- VIP: `POST /api/vip` (STAFF create) + `GET /api/vip` (STAFF's own), `GET /api/vip/queue` (HEAD
  pending), `GET /api/vip/expected` (guard incoming directory: PENDING+APPROVED),
  `PATCH /api/vip/:id/decision` (HEAD), `GET /api/vip/verify?token=`, `POST /api/vip/checkin`,
  `POST /api/vip/exit`.
- `GET /api/analytics/dashboard` (HEAD KPIs, category/gate breakdown, overstay).

**HEAD-only admin:** `PATCH /api/visits/:id` & `PATCH /api/vip/:id` (edit any record),
`POST /api/admin/visits` & `POST /api/admin/vip` (generate directly, auto-approved),
`GET|PATCH /api/admin/settings`, `GET|POST /api/admin/blacklist` + `PATCH|DELETE .../:id`,
`GET /api/admin/defaulters`, form builder `POST /api/admin/forms/categories` + `.../:id`,
`POST /api/admin/forms/fields` + `.../:id`.

Response conventions: `lib/server/http.ts` (`ok`/`fail`/`parseOr400`/`sameOrigin`/`clientIp`);
generic error envelopes (no stack/PII). Auth via `getGuard()` in `lib/server/session.ts`
(`isPrivileged`/`isHead`/`canAccessGate`).

---

## 8. Frontend pages
- `app/register/page.tsx` — public intake. Fetches `/api/config/forms`, renders categories/fields
  dynamically. **New Flow**: Frequent visitors can enter phone number to auto-fill details. Includes a "Mode of Transport" toggle (Foot vs Vehicle); vehicle number required if on vehicle. Camera selfie (`components/CameraCapture.tsx`, compresses to <100 KB), universal OTP step, success screen shows a **QR of the reference code**.
- `app/guard/page.tsx` — **Tablet-Optimized UI**: (1) **Live Traffic** master feed of big cards (large
  128px selfie, license-plate vehicle number, category chip, blacklist/overstay badges,
  "Requested at" time, "Inside for" duration, giant, simple **APPROVE ENTRY** / **MARK EXIT** buttons for less literate guards — **no
  reject button**, tap card → full-details modal showing the whole submitted form); (2) **Scan QR**
  (native `BarcodeDetector` camera + manual entry → lookup → card). Sticky search. 5s polling (fast syncing).
- `app/head/page.tsx` — HEAD command center: extensive analytics (KPIs, category bars, gate throughput,
  defaulters prompt), and 3 operational tabs — **VIP Clearance Pool** (approve/reject VIP),
  **Escalated Incidents**, **Live Traffic (All)** (unified feed of standard+VIP, pending+active,
  with Requested-At, overstay-red rows with specific alerts e.g., delivery > 30 mins, and **direct Approve/Reject on standard pending rows**).
  Plus **Dynamic Forms Builder** and **Blacklist Registry** sections, edit modals, generate-pass,
  and system settings with full control.
- `app/staff/page.tsx` — create VIP passes + view QR + track status.
- `app/page.tsx` — landing/links. `app/providers.tsx` — React Query + NextAuth SessionProvider.

---

## 9. Server helpers (`lib/server/`)
`prisma.ts` (singleton), `session.ts` (auth/role/gate helpers), `http.ts` (responses),
`forms.ts` (dynamic form config + validator + snapshot), `settings.ts` (`getSettings` singleton),
`blacklist.ts` (`getActiveBlacklistPhones`, `isPhoneBlacklisted`), `overstay.ts`
(`minutesInside`, `isOverstaying`), `blob.ts` (sharp re-encode → Vercel Blob or local fallback),
`ratelimit.ts` (Upstash, no-ops if unconfigured), `dto.ts` (VisitLog→DTO), `vip.ts` (VIP DTO +
token + effectiveStatus). Validation in `lib/validation/{visit,vip,otp,admin}.ts`.
Auth config split: `auth.config.ts` (edge-safe) + `auth.ts` (Node, Credentials+argon2);
`middleware.ts` gates `/admin`.

---

## 10. Notable decisions, deviations & gotchas
- **Prisma pinned to 6** (7 breaks the datasource schema). 
- **`VisitorCategory` enum removed** → `VisitLog.category` is a string key; the Phase-4 migration
  was hand-edited to `ALTER COLUMN … TYPE TEXT USING category::text` to preserve existing rows.
- **Blob disabled** → selfies save to `public/uploads/` locally. Re-enable by uncommenting
  `BLOB_READ_WRITE_TOKEN` in `.env` and setting the Vercel Blob store to **public access** (a
  private store rejects `access: "public"`).
- **AUTH_SECRET is a dev placeholder** — replace for prod.
- **OTP hardcoded to `PARENT`** category key (see §6).
- **IDOR relaxed** for guards (campus-wide) by product request — was previously gate-scoped.
- **`lib/categories.ts`** is now only seed data, not the runtime form source.
- Neon auto-suspend: a cold request may fail once; retry wakes it.
- `docs`: `README.md`, `BACKEND.md`, `PLAN.md` exist; the working design log is
  `~/.claude/plans/you-are-an-expert-velvety-hippo.md`.

---

## 11. Current status
**Phases 1–4 complete and verified.** `npx tsc --noEmit` clean; `npx next build` clean.
Latest work: unified guard master feed + universal QR scanner, big-selfie/details-modal/no-reject
guard cards, 2-hour overstay red alerts, admin Live-Traffic feed showing standard+VIP with
timestamps/overstay, and **HEAD direct approve/reject of standard pending** from the admin panel.

### Possible next steps / not yet done
- Make OTP a per-category toggle (`requiresOtp` on `FormCategory`) instead of hardcoded PARENT.
- Real OTP via SMS + Redis (currently dummy code + HMAC token).
- Re-enable Vercel Blob (public store) for cloud selfie storage.
- Optional: HEAD exit/gate actions on active rows in the admin feed (currently approve/reject
  only on standard pending; exits need a gate to stamp).
- Rotate `AUTH_SECRET` and demo passwords before any real deployment.

---

## 12. Verification quickstart
```bash
npx tsc --noEmit          # types
npx next build            # full build (all routes)
npx prisma migrate status # DB/migration sync
```
End-to-end pattern used throughout: log in via NextAuth credentials (CSRF → callback → cookie
jar), then hit the APIs with the session cookie; scripts live-cleaned their test rows. Example
verified flow: register at Gate 2 → appears campus-wide in `/api/guard/feed` (PENDING) → approve
→ ACTIVE → exit at any gate → leaves feed.
