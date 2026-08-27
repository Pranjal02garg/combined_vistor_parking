# Faculty Parking Mobile Backend Handoff (Next.js)

## 1. Objective
Enable the existing Next.js app to serve as a secure backend for:
1. Admin web portal (existing browser flow, keep unchanged).
2. Expo mobile app (new Bearer-token API flow).
3. Mobile user profile edit functionality.

## 2. Current State Summary
1. The backend currently uses secure browser auth:
- HttpOnly cookie sessions.
- CSRF token checks.
- Same-origin checks.
- MongoDB-backed sessions with token hash storage.
2. The mobile app expects:
- Bearer token in Authorization header.
- Mobile endpoints under /api/mobile/auth/*
- Login response containing token + user.
3. There is a contract mismatch today:
- Existing /api/auth/* routes are cookie + CSRF web routes.
- Mobile cannot reliably use those routes.

## 3. Target Architecture
1. Keep web auth routes as-is:
- /api/auth/login
- /api/auth/logout
- /api/auth/session
- /api/auth/csrf
2. Add a separate mobile API surface:
- /api/mobile/auth/login
- /api/mobile/auth/me
- /api/mobile/auth/logout
- /api/mobile/auth/change-password
- /api/mobile/auth/profile (PATCH for edit user details)
3. Reuse the same MongoDB users and sessions collections.
4. Never allow mobile app direct database access.

## 4. Required Change Set

## 4.1 Add Shared Mobile Auth Utility
Create a reusable server utility used by all /api/mobile protected routes.

It must:
1. Read Authorization header.
2. Validate Bearer format.
3. Hash raw token with the same hashing logic already used for sessions.
4. Find session by tokenHash and ensure it is not expired.
5. Load user and enforce account active checks.
6. Slide session expiry window (same as current session behavior).
7. Return a normalized mobile auth context:
- user
- session
- raw token
- session id

## 4.2 Add Mobile User DTO Mapping
Create a mobile-safe user response mapper.

Return only allowed fields:
1. id
2. email
3. role
4. name
5. department (optional)
6. faculty_id (optional)
7. allowed (map from parkingEligible or dedicated field)
8. isActive (optional if needed by UI)

Do not return:
1. passwordHash
2. failedLoginAttempts
3. lockUntil
4. internal audit-only fields

## 4.3 Implement Mobile Auth Endpoints

### POST /api/mobile/auth/login
1. Validate payload: email, password.
2. Rate-limit by IP + email.
3. Check lockout state.
4. Verify password hash.
5. Invalidate previous session for this client policy (or keep multi-device policy if desired).
6. Create new MongoDB session.
7. Return raw token and normalized user object.

Success response:
{
  "token": "raw-session-token",
  "user": {
    "id": "string",
    "email": "user@domain.com",
    "role": "user",
    "name": "Faculty Name",
    "department": "CSE",
    "faculty_id": "FAC001",
    "allowed": true
  },
  "session": {
    "expiresAt": "ISO timestamp"
  }
}

### GET /api/mobile/auth/me
1. Require valid Bearer token.
2. Return normalized user object + session expiry.

### POST /api/mobile/auth/logout
1. Require valid Bearer token.
2. Invalidate session row by token hash.
3. Return success response.

### POST /api/mobile/auth/change-password
1. Require valid Bearer token.
2. Validate currentPassword and newPassword.
3. Verify currentPassword against stored hash.
4. Enforce password policy.
5. Save new password hash and updatedAt.
6. Optional security policy:
- invalidate all other sessions for this user
- keep current session active

### PATCH /api/mobile/auth/profile
1. Require valid Bearer token.
2. Accept only whitelisted fields for self-edit.
3. Reject unknown keys.
4. Update only authenticated user’s own document.

Recommended editable fields:
1. name
2. department
3. phone (if you add it)
4. alternateContact (if you add it)

Forbidden fields in this route:
1. role
2. isActive
3. parkingEligible or allowed
4. failedLoginAttempts
5. lockUntil
6. passwordHash

## 4.4 Error Contract Standardization (Mobile Routes)
Use one consistent shape:

{
  "error": "MACHINE_CODE",
  "message": "Human readable message",
  "retryAfterSeconds": 300
}

Status policy:
1. 400 invalid payload
2. 401 invalid credentials or invalid/expired token
3. 403 authenticated but forbidden
4. 423 locked account (include retryAfterSeconds)
5. 429 rate-limit throttling
6. 500 server error

Note:
If existing web routes currently use different status conventions, keep them unchanged. Apply this standard to mobile routes.

## 4.5 Security Requirements for Mobile Routes
1. Do not apply CSRF requirement on Bearer-token mobile routes.
2. Do not apply strict browser origin checks to mobile routes.
3. Keep strong rate limiting on login, password change, and profile update.
4. Keep generic credential error messages to prevent enumeration.
5. Never log raw tokens or passwords.
6. Enforce HTTPS in production.
7. Keep session token hash-only storage in MongoDB (no raw token persistence).
8. Optional hardening later:
- Play Integrity (Android)
- App Attest or DeviceCheck (iOS)

## 4.6 Data Model Updates (Users)
If mobile profile needs additional fields, extend users schema with optional fields:
1. department
2. faculty_id
3. phone
4. alternateContact

Add validation and safe defaults.
Do not break existing admin dashboard behavior.

## 5. Mobile App Compatibility Notes
1. Mobile app already calls /api/mobile/auth/login and expects token in response.
2. Mobile app uses Bearer token for subsequent requests.
3. Align password policy between backend and app UI.
- Current backend policy appears stricter than app login/change password forms.
- Either update app validation to match backend policy or relax backend policy intentionally.
4. Align lockout status handling:
- Mobile app currently expects 423 lock handling.

## 6. Acceptance Criteria
1. Mobile login works with valid credentials and returns token.
2. Invalid login returns generic 401 message.
3. Locked account returns 423 + retryAfterSeconds.
4. me endpoint returns user when token valid.
5. me endpoint returns 401 when token expired/invalid.
6. logout invalidates server session.
7. profile patch updates only allowed fields.
8. profile patch cannot modify role/allowed/isActive/admin fields.
9. change-password verifies current password and enforces policy.
10. Existing admin web login/logout/dashboard continue working unchanged.

## 7. Test Checklist
1. Postman or curl tests for each mobile endpoint.
2. Expired-token test for all protected mobile routes.
3. Mass-assignment test on profile patch (attempt role update).
4. Brute-force test for login rate limit and lockout behavior.
5. Regression test for existing web auth routes.

## 8. Deployment Plan
1. Implement mobile routes in Next.js.
2. Deploy backend to staging.
3. Point Expo app base URL to staging backend.
4. Run end-to-end auth/profile flows on real device.
5. Deploy backend to production.
6. Update Expo production API base URL.
7. Monitor auth failures, lockouts, and latency.

## 9. Definition of Done
1. One deployed Next.js service supports both web admin and mobile app.
2. Web uses cookie+CSRF routes.
3. Mobile uses Bearer-token routes.
4. MongoDB remains single source of truth for users and sessions.
5. Mobile user detail edit flow is secure and functional.