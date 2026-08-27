# Report 8: QR, Mobile, and Barrier Flows

This report explains the parts of the app that handle QR sessions, mobile scanning, and barrier-related actions.

## Why this exists

The QR flow lets one system create a temporary session that another system can scan and verify. This is useful when a parking entry point or mobile app needs to confirm a user quickly.

## QR session lifecycle

The QR system generally follows this pattern:

1. Create a short-lived QR session.
2. Render or display the QR payload.
3. Poll session status from another client.
4. Mark the session as scanned or verified.
5. Let the caller continue based on the result.

## Shared service layer

The QR logic is stored in shared auth/auth-adjacent service files so multiple routes can reuse the same behavior. That avoids duplicating session rules across different entry points.

## Mobile scan route

The mobile scan endpoint accepts scan submissions from an external client. In this repo, that means the backend does not assume the scanner is the browser itself. Instead, it treats scanning as a separate authenticated request.

## Barrier integration

The repository also contains barrier-related routes. These routes are part of the physical-world integration of the parking system, where a backend action may control access hardware or unlock behavior.

## Beginner takeaway

This is the most system-integration part of the codebase. It combines backend auth, temporary sessions, and external clients, so it is a good example of how the app extends beyond a normal CRUD dashboard.

## QR request workflow

The QR flow typically uses several parts of the codebase in sequence:

1. A browser or client asks for a QR session through a route under `src/app/api/qr/session/`.
2. `src/lib/auth/qr-session.ts` creates and stores the temporary session state.
3. `src/lib/http/cors.ts` and related helpers allow external clients to call the route safely.
4. Another client polls the session status through the session endpoint.
5. The scanner or mobile client submits scan confirmation to the mobile scan route.
6. The backend updates session state and returns the result.

## Why this is separate from normal auth

QR sessions are short-lived and purpose-specific. They are not the same thing as the long-lived login session cookie used by the admin portal. The app keeps those responsibilities separate so the systems do not interfere with each other.

## File map for this flow

- `src/lib/auth/qr-session.ts` stores QR lifecycle logic.
- `src/lib/http/cors.ts` handles cross-origin access rules.
- `src/app/api/qr/session/route.ts` creates or manages QR sessions.
- `src/app/api/qr/session/[sessionId]/route.ts` handles polling and status lookup.
- `src/app/api/mobile/qr/scan/route.ts` accepts the external scan submission.

If you follow those files in order, you can reconstruct the entire QR path.