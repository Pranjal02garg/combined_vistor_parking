# Secure Login and Logout in Next.js 16 with MongoDB Database Sessions

This project now includes a complete authentication system using:

- Next.js 16 App Router and Route Handlers
- MongoDB for both users and sessions
- HttpOnly cookie sessions (database-backed)
- Secure password hashing with Argon2id
- Session invalidation + rotation behavior
- Brute-force protection with account lockout
- API rate limiting for auth routes
- CSRF protection for all state-changing auth requests
- Route guarding using `proxy.ts` (the Next.js 16 replacement for middleware)

## 1. What Was Implemented

### Authentication APIs

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/auth/csrf`

These endpoints live under `src/app/api/auth/` and use secure defaults.

### UI Pages

- `/` Home page with auth-aware state
- `/login` Sign-in page
- `/register` Account creation page
- `/dashboard` Protected page (requires valid session)

### Auth Backend Modules

Core auth logic is split into dedicated files under `src/lib/auth/`:

- `constants.ts`: session and lockout settings
- `crypto.ts`: Argon2 password hashing + session token hashing
- `request.ts`: origin validation and request metadata extraction
- `service.ts`: MongoDB user/session operations and cookie/session lifecycle
- `types.ts`: auth document and DTO types
- `validators.ts`: Zod input schemas

### Infrastructure Modules

- `src/lib/mongodb.ts`: shared MongoDB client and DB access
- `src/lib/env.ts`: runtime env validation with Zod
- `src/proxy.ts`: request-time route check + security headers

## 2. How Session Authentication Works Here

### Step A: Login

1. User submits email/password.
2. Client fetches a CSRF token from `GET /api/auth/csrf`.
3. Request includes `x-csrf-token` header bound to the CSRF cookie.
4. Origin and fetch metadata are validated.
5. Request-level rate limiting is enforced.
6. Credentials are validated with Zod.
7. Password is verified using Argon2id.
8. A random session token is created.
9. Only a SHA-256 hash of that token is stored in MongoDB (`sessions` collection).
10. Raw token is sent to browser in an HttpOnly cookie.

### Step B: Authenticated Request

1. Cookie token arrives with request.
2. Server hashes token.
3. Session is looked up by token hash in MongoDB.
4. If valid and not expired, the related user is loaded.
5. Session expiry is refreshed (sliding expiration) when nearing half-life.

### Step C: Logout

1. Current token hash session row is deleted from DB.
2. Session cookie is expired immediately.

This creates true server-side session invalidation: once deleted in DB, a stolen cookie can no longer be used.

## 3. Security Features Included

### Password Storage

- Argon2id hashing (`argon2` package)
- No plaintext password storage
- Password complexity + minimum length enforcement

### Session Security

- Random, high-entropy session tokens (`crypto.randomBytes`)
- DB stores token hash only (not raw token)
- HttpOnly cookie (not accessible to JavaScript)
- `sameSite: "lax"`
- `secure: true` automatically in production
- Session invalidation on logout
- Existing session invalidated before creating a new one on login/register

### CSRF Defense

- CSRF token is issued by `GET /api/auth/csrf` and mirrored in cookie + response payload.
- Login/register/logout requests must send `x-csrf-token` that matches cookie value.
- CSRF token check is combined with same-origin/fetch-site validation.

### Brute-force Protection

- Failed login counter per account
- Automatic temporary lockout after repeated failures
- Generic login error message for invalid credentials

### Request Rate Limiting

- In-memory rate limiter for login/register/logout endpoints
- `429` responses include `Retry-After`
- Helps reduce credential stuffing and script abuse

### Request Hardening

- Same-origin checks on state-changing auth routes (`login`, `register`, `logout`)
- `sec-fetch-site` validation for suspicious cross-site requests
- Extra security headers set in `src/proxy.ts`
- `X-Powered-By` disabled in `next.config.ts`
- No-store API responses for auth/session endpoints

### Route Protection

- `src/proxy.ts` blocks unauthenticated access to `/dashboard` if no session cookie is present
- Real auth enforcement is also done inside server page code (`dashboard/page.tsx`) to prevent bypass

## 4. Database Collections and Indexes

Two collections are used:

- `users`
- `sessions`

Indexes are auto-created by the auth service:

- `users.email` unique index
- `sessions.tokenHash` unique index
- `sessions.userId` index
- `sessions.expiresAt` TTL index (automatic cleanup of expired sessions)

## 5. Setup Instructions

## Prerequisites

- Node.js 20+
- MongoDB running locally or remotely

## Configure Environment

Copy `.env.example` to `.env.local` and update values:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=parking_app
APP_ORIGIN=http://localhost:3000
```

`APP_ORIGIN` must match your actual app origin.

## Install and Run

```bash
npm install
npm run dev
```

Then open:

- `http://localhost:3000`

## 6. How to Test the Flow

1. Go to `/register` and create an account.
2. You should be redirected to `/dashboard` and receive a session cookie.
3. Refresh `/dashboard` to confirm session persistence.
4. Click `Sign out` and verify you are redirected to `/login`.
5. Hit `GET /api/auth/session`:
   - While logged in: returns user + session info
   - While logged out: returns 401

## 7. Important Learning Notes for You

Since you said you are new to Next.js, these are key concepts this project demonstrates:

- Route Handlers (`app/api/.../route.ts`) are your backend endpoints in App Router.
- `cookies()` from `next/headers` is async in modern Next.js.
- `proxy.ts` is the Next.js 16 replacement for `middleware.ts`.
- Proxy checks are useful for fast routing decisions, but authorization must still happen in server code.
- Secure auth means:
  - hash passwords
  - use HttpOnly cookies
  - store sessions server-side
  - invalidate sessions server-side
  - protect against brute force and cross-origin attacks

## 8. Production Hardening Suggestions

For real production rollout, consider adding:

- Email verification before first login
- MFA (TOTP/WebAuthn)
- Distributed IP-based rate limiting (Redis)
- Device/session management UI (list and revoke sessions)
- Audit logging of auth events
- Strict CSP tailored to your frontend assets
- Secret rotation and robust backup/restore practices

## 9. Quick File Map

- `src/lib/env.ts`
- `src/lib/mongodb.ts`
- `src/lib/auth/constants.ts`
- `src/lib/auth/crypto.ts`
- `src/lib/auth/csrf.ts`
- `src/lib/auth/rate-limit.ts`
- `src/lib/auth/request.ts`
- `src/lib/auth/service.ts`
- `src/lib/auth/types.ts`
- `src/lib/auth/validators.ts`
- `src/lib/http/response.ts`
- `src/proxy.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/session/route.ts`
- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/components/credentials-form.tsx`
- `src/components/logout-button.tsx`

You now have a full secure-session authentication baseline for building the rest of your parking application.

## 10. Troubleshooting Common Issues

### "Password error" while creating account

The password policy is strict by design. It must include:

- At least 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one symbol

Example: `SecurePass!2026`

### `GET /api/auth/session` returns `Not authenticated`

This is normal if no valid session cookie exists yet. You must:

1. Successfully register or login first
2. Call the session endpoint from the same browser session

### `Database connection failed` errors

Check the following:

- Env file location is `parking-app/.env.local`
- Variable name is `MONGODB_URI` (not `MONGO_URI`)
- Atlas/network access is allowed from your current IP
- If `mongodb+srv` DNS resolution fails in your environment, use a non-SRV URI format with explicit hosts
