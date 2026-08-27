# Report 5: API Layer and Route Handlers

This report explains the backend endpoints that the browser and mobile flows call.

## Auth routes

The auth routes live under `src/app/api/auth/`:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/auth/csrf`

These routes handle the main login lifecycle and session checks.

## Mobile and QR routes

The repo also includes routes under `src/app/api/mobile/` and `src/app/api/qr/` for mobile scans, QR session creation, and polling.

## Route handler responsibilities

Each route handler usually does the same kinds of work:

- parse input,
- validate it,
- call shared service code,
- query or update MongoDB,
- return JSON,
- and set appropriate response headers or cookies.

This is the backend equivalent of a controller in other frameworks.

## Why the API exists even with server components

Not every data flow in the app needs a public API. But route handlers are still useful when:

- a browser client component needs data after hydration,
- an external mobile app must talk to the server,
- a request needs a dedicated JSON response,
- or the action is not tied to one React page.

## What to look for when reading an endpoint

For every route file, ask:

1. What input does it expect?
2. What auth or CSRF checks does it perform?
3. Which collection does it touch?
4. What does it return on success and failure?
5. Does it set cookies, headers, or redirects?

That checklist is enough to understand the majority of the backend code.

## Beginner takeaway

If the app is the building, the route handlers are the doors and service entrances. They are how outside requests get into the system safely.

## Endpoint processing map

Most route handlers follow the same internal order:

1. Read request headers, cookies, and body.
2. Validate origin or CSRF if the request mutates data.
3. Validate payload shape.
4. Call a service or query helper.
5. Turn the result into JSON or a redirect.
6. Apply no-store or security headers when needed.

This makes the route files thin controllers rather than places where all logic gets duplicated.

## Key files to compare

To understand route processing end to end, compare these files together:

- `src/components/credentials-form.tsx`
- `src/app/api/auth/csrf/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/lib/auth/request.ts`
- `src/lib/auth/csrf.ts`
- `src/lib/auth/service.ts`
- `src/lib/http/response.ts`

Those files together show browser input, request validation, business logic, and response handling.