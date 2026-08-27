# Campus Gate Pass — Backend (Phase 2)

Zero-trust API for the Multi-Gate VMS: **Next.js Route Handlers + Prisma 6 +
PostgreSQL (Neon)**, with **NextAuth v5** auth, **Vercel Blob** selfie storage, and
**Upstash Redis** rate limiting.

> Status: backend is implemented and builds clean. The `/register` and `/guard` pages
> still run on the Phase-1 `localStorage` store until the DB is reachable; the cutover to
> this API is the next step.

---

## 1. Environment setup

Copy `.env.example` → `.env` (git-ignored) and fill in real values.

| Variable | Where it comes from | Notes |
|---|---|---|
| `DATABASE_URL` | Neon → **pooled** connection string | Used by the app at runtime. Append `?sslmode=require`. Neon's pooled host contains `-pooler`. |
| `DIRECT_URL` | Neon → **direct** (non-pooled) string | Used by Prisma Migrate only. Same DB, no `-pooler`. |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob → **Read/Write token** | If unset locally, selfies fall back to `public/uploads/` (dev only). |
| `UPSTASH_REDIS_REST_URL` | Upstash console → your DB → **REST URL** | If unset locally, rate limiting is disabled (dev only). |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console → **REST token** | — |
| `AUTH_SECRET` | `openssl rand -base64 32` | Signs the NextAuth JWT. Required. |

### Provisioning steps
```bash
# 1. Fill .env with the six values above.

# 2. Create tables on Neon (uses DIRECT_URL).
npx prisma migrate dev --name init

# 3. Seed gates + demo staff.
npm run db:seed

# 4. Run.
npm run dev
```

### Demo accounts (created by the seed — rotate before real use)
| Email | Password | Role | Gates |
|---|---|---|---|
| `admin@campus.edu` | `admin123` | ADMIN | all |
| `gate1@campus.edu` | `guard123` | GUARD | Gate 1 only |
| `gate2@campus.edu` | `guard123` | GUARD | Gate 2 only |

Gate 1-only vs Gate 2-only is intentional — it demonstrates the IDOR protection
(`gate1` gets `403`/`404` on Gate 2 data).
*(Note: Guard accounts are gate-specific to simplify logins, instead of having a unique login for every individual guard).*

### Handy scripts
- `npm run db:migrate` → `prisma migrate dev`
- `npm run db:seed` → `prisma db seed`
- `npm run db:studio` → Prisma Studio (browse the DB)

---

## 2. Data model (summary)

See [prisma/schema.prisma](prisma/schema.prisma) for the source of truth.

- **User** — staff. `role` ∈ `GUARD | SUPERVISOR | ADMIN`; `passwordHash` (Argon2id);
  many-to-many `gates` (which gates a guard may operate).
- **Gate** — `code` (stable QR code, e.g. `"1"`), `name`, `location`, assigned `staff`.
- **Visitor** — reusable identity, deduped by unique `phone`.
- **VisitLog** — one visit: `referenceCode` (crypto, shown to visitor), `category`,
  `details` (JSON of category-specific fields), `selfieUrl`, `status`
  (`PENDING | APPROVED | REJECTED | ESCALATED | EXITED`), entry/exit gate + timestamps,
  and which staff decided/exited it.

All primary keys are opaque `cuid()`; the only visitor-facing token is `referenceCode`.

---

## 3. API contract

Base URL: same origin. All bodies are JSON. Error responses share the shape
`{ "error": string, "details"?: unknown }` and never include stack traces or internal ids.

Auth legend: **Public** = no auth · **Guard** = a signed-in staff session (any role).

### `POST /api/visits` — Public
Visitor submits a check-in.

Request body:
```jsonc
{
  "entryGate": "1",                 // Gate.code (from the QR / ?gate=)
  "name": "Ravi Kumar",             // 2–60 letters/spaces/dots
  "phone": "9812345670",            // exactly 10 digits
  "selfie": "data:image/jpeg;base64,...",  // JPEG data URL, ≤ ~3 MB
  "fields": {                       // category-specific; discriminated by `category`
    "category": "DELIVERY_VENDOR",
    "company": "Swiggy",
    "purpose": "Food Delivery",
    "deliverTo": "Hostel J",
    "vehicleNumber": "PB10AB1234"   // optional here
  }
}
```
`category` values: `PARENT | DELIVERY_VENDOR | TAXI | CONTRACTOR | OFFICIAL | STAFF |
RESIDENT | OTHERS`. Each has its own required fields (see
[lib/validation/visit.ts](lib/validation/visit.ts)). Example: `PARENT` requires
`studentName` + `purpose`, and `hostel` **only when** `purpose === "Pickup"`.

Success `201`:
```json
{ "referenceCode": "VMS-7QX2A", "status": "PENDING" }
```
Errors: `400` validation / unknown gate · `403` bad origin · `413` too large ·
`422` bad photo · `429` rate limited.

Security: per-IP rate limit, Origin check, body-size cap, strict Zod, server-side
`sharp` re-encode (strips EXIF, verifies magic bytes) → Vercel Blob (or AWS S3 via Docker later). Response reveals
**only** the reference code + status. Note: universal OTP verification will ensure phone numbers are reachable before submission.

---

### `GET /api/visits/queue?gateId=<cuid>&cursor=<cuid>` — Guard
Pending/escalated queue **for one gate**.

Success `200`:
```jsonc
{
  "items": [
    {
      "id": "clx…", "referenceCode": "VMS-7QX2A",
      "category": "DELIVERY_VENDOR", "name": "Ravi Kumar", "phone": "9812345670",
      "vehicleNumber": null, "details": { /* category fields */ },
      "selfieUrl": "https://…", "status": "PENDING",
      "entryGateId": "clx…", "exitGateId": null,
      "createdAt": "2026-07-01T…", "approvedAt": null, "exitedAt": null
    }
  ],
  "nextCursor": "clx…"   // or null when no more pages (page size 50)
}
```
Errors: `401` not signed in · `403` gate not permitted (IDOR) · `429`.

**IDOR:** allowed only if the caller is `ADMIN`/`SUPERVISOR` or `gateId ∈ session.gateIds`.

---

### `PATCH /api/visits/:id/decision` — Guard
Approve / reject / escalate a pending visit.

Request body: `{ "action": "approve" | "reject" | "escalate" }`

Success `200`: `{ "id": "clx…", "status": "APPROVED" }`

Errors: `400` bad body · `401` · `404` unknown **or** not-your-gate (deliberately merged
so existence can't be probed across gates) · `409` already decided · `429`.

Notes: only the visit's **entry-gate** staff (or privileged roles) may decide;
`approve` stamps `approvedAt` and `decidedById`; the update is atomic (wins races with
another guard).

---

### `POST /api/visits/exit` — Guard
Mark a visitor's exit — **cross-gate allowed** (that's the feature).

Request body:
```json
{ "referenceCode": "VMS-7QX2A", "exitGateId": "clx…" }
```
Success `200`: `{ "referenceCode": "VMS-7QX2A", "status": "EXITED" }`

Errors: `400` unknown gate / bad body · `401` · `403` exit gate not permitted ·
`404` unknown reference · `409` visitor not currently inside · `429`.

Notes: the guard must be allowed on the **exit** gate; the visit must be `APPROVED`
(you can't exit someone who never entered). Sets `exitedAt`, `exitGateId`, `exitedById`.

---

### `GET /api/visits/search?q=<2–40 chars>` — Guard
Find an `APPROVED` visitor to sign out. **Campus-wide by design** (cross-gate exit),
auth-required, read-only. Matches on reference code, vehicle, name, or phone.

Success `200`: `{ "items": [ /* VisitDTO[], up to 25 */ ] }`

Errors: `401` · `400` bad query · `429`.

---

### `GET|POST /api/auth/[...nextauth]` — Public (NextAuth v5)
Standard NextAuth endpoints (`/session`, `/signin`, `/signout`, CSRF). Sign in with the
**Credentials** provider (email + password). The JWT session carries `role` and
`gateIds`.

---

## 4. Security controls → OWASP

| Concern | Control |
|---|---|
| A01 Broken access / IDOR | Auth + role/gate re-derived from the server session on every request; gate-scoped queue; entry-gate-scoped decisions; merged 404 to prevent cross-gate probing |
| A02 Crypto failures | Argon2id password hashing; `AUTH_SECRET`-signed JWT; secrets only in env |
| A03 Injection (SQLi) | Prisma parameterises everything; no raw SQL |
| A03 XSS | Server Zod restricts inputs to safe charsets; React auto-escapes on render |
| A04 Insecure design | Explicit visit state machine; least-privilege roles |
| A05 Misconfiguration | Generic error envelopes; no stack/PII leakage |
| A08 Data integrity | Selfies re-encoded by `sharp` (defuses polyglot/SVG/EXIF), magic-byte checked, size-capped, stored in object storage |
| CSRF | NextAuth CSRF token for auth; SameSite cookies + `Origin` allow-list on state-changing routes |
| DoS / brute force | Upstash sliding-window: submit 5/min·IP, guard actions 60/min·user, login 10/5min·IP; request body-size limits |
| Enumeration | `cuid` PKs + separate crypto `referenceCode`; uniform not-found responses |

---

## 5. Quick manual test (once migrated + seeded, server running)

```bash
# Public submit (fill in a real base64 JPEG for selfie):
curl -X POST http://localhost:3000/api/visits \
  -H 'Content-Type: application/json' \
  -d '{"entryGate":"1","name":"Test User","phone":"9990001111",
       "selfie":"data:image/jpeg;base64,/9j/....",
       "fields":{"category":"OTHERS","purpose":"Meeting","meetPerson":"Dean office"}}'
# → { "referenceCode": "VMS-XXXXX", "status": "PENDING" }

# Guard routes require a session cookie — easiest to exercise them from the
# browser after signing in, or via the upcoming refactored /guard UI.
```

IDOR check to try in-app: sign in as `guard1` (Gate 1) and request the Gate 2 queue →
expect `403`. Exit a `PENDING` (not yet approved) reference → expect `409`.
