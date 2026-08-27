# Report 4: Authentication and Security

This report explains the most important part of the app: how login, logout, sessions, and security controls work.

## Authentication model

The app uses database-backed sessions, not JWTs in the browser. That means the browser stores only a session token cookie, while the server stores the real session record in MongoDB.

The auth logic lives mostly in `src/lib/auth/service.ts`, with support from files in `src/lib/auth/` for password hashing, validation, CSRF, rate limiting, and request inspection.

## Login flow

When a user logs in:

1. The form sends credentials to the login route.
2. The request is checked for CSRF and origin safety.
3. The credentials are validated.
4. The password is verified with Argon2id.
5. A new session token is generated.
6. Only a hashed copy of the session token is stored in MongoDB.
7. The raw token is set in an HttpOnly cookie.

## Logout flow

Logout removes the session from the database and clears the cookie. This is stronger than just removing a cookie because the server-side session is actually invalidated.

## Password security

Passwords are never stored in plain text. The repo uses Argon2id hashing and applies password policy validation at registration and admin-created user flows.

## Session security

The session cookie is configured to be:

- HttpOnly,
- path scoped to the app,
- same-site lax,
- secure in production.

This makes it much harder for client-side JavaScript or cross-site requests to abuse the session.

## CSRF protection

The app uses a double-submit style CSRF pattern. A CSRF token is issued and then required back on state-changing auth requests.

The important beginner idea is this: even if a browser automatically sends cookies, the attacker still should not be able to forge a valid state-changing request from another site.

## Brute-force protection

The code also protects against repeated login failures using failed-attempt counters and temporary account lockouts.

## Route protection

There are two layers of protection:

- `src/proxy.ts` blocks obvious unauthenticated access before the request reaches the page.
- Server-side page logic still checks auth before sensitive data is rendered.

That redundancy matters because security should not rely on only one gate.

## Beginner takeaway

If you understand only one report deeply, make it this one. It explains how identity is proven, how sessions are stored, and why the app is designed the way it is.

## Full login request trace

This is the exact flow for a login request in the codebase:

1. `src/components/credentials-form.tsx` loads a CSRF token from `src/app/api/auth/csrf/route.ts` through `getClientCsrfToken()`.
2. The browser submits email and password to `src/app/api/auth/login/route.ts`.
3. `src/lib/auth/request.ts` checks origin, fetch site, IP, and user agent.
4. `src/lib/auth/csrf.ts` verifies the CSRF token.
5. `src/lib/auth/validators.ts` validates the payload shape.
6. `src/lib/auth/rate-limit.ts` limits repeated attempts by client and email.
7. `src/lib/auth/service.ts` looks up the user, checks lockout state, and verifies the password.
8. `src/lib/auth/crypto.ts` verifies the Argon2id hash.
9. `src/lib/auth/service.ts` clears old session state, creates a new session row, and sets the HttpOnly cookie.
10. `src/lib/http/response.ts` returns a no-store JSON response.

That path is the clearest example of how the app is built.

## Full logout request trace

Logout is the inverse path:

1. The browser sends the logout request with the session cookie.
2. The route validates origin and CSRF again.
3. The current session token is read from the cookie.
4. The matching MongoDB session row is deleted.
5. The cookie is cleared.
6. The browser is redirected or refreshed away from protected state.

The important point is that logout is not only a browser-side action. The server deletes the source-of-truth session.