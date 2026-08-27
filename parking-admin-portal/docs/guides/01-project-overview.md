# Report 1: Project Overview and Mental Model

This project is a Next.js 16 admin portal backed by MongoDB. It manages users, parking eligibility, vehicle lists, QR/session flows, and a protected dashboard for admins. The codebase is split into a few clear layers:

- `src/app/` contains the UI pages and API routes.
- `src/components/` contains reusable client and form components.
- `src/lib/` contains database, auth, HTTP, and utility logic.
- `src/proxy.ts` protects routes and adds security headers.

The most important idea for a beginner is that Next.js in this repo is not just a frontend framework. It is the whole application platform. Pages, server actions, API endpoints, and route protection all live in the same project.

## How a request moves through the app

When a user opens the app, the request first passes through `src/proxy.ts`. That file can redirect unauthenticated visitors away from `/dashboard`. If the request is for a page or route handler, Next.js then loads the correct server or client component. If the page needs data from MongoDB, it uses the shared database helpers in `src/lib/mongodb.ts` and the auth service in `src/lib/auth/service.ts`.

For auth-related requests, the flow is usually:

1. The browser sends form data or JSON to an API route.
2. The route validates input.
3. The auth service checks credentials or session state.
4. MongoDB is queried or updated.
5. The response sets cookies, returns JSON, or redirects.

## What this app is trying to solve

The portal is built for admin management of parking access. That means the app cares about:

- who the user is,
- whether they are active,
- whether they can park,
- what vehicles belong to them,
- and whether their current session is still valid.

That combination of identity, authorization, and business data is why the repo has a strong auth layer and a fairly structured data model.

## What a beginner should learn first

If you are new to Next.js, TypeScript, or React, the order matters. Learn this repo in this sequence:

1. Understand the folder structure and the purpose of each top-level directory.
2. Learn how pages are rendered in `src/app/`.
3. Learn how the app talks to MongoDB.
4. Learn how login sessions work.
5. Learn how the dashboard reads and mutates user data.
6. Learn how the API endpoints and server actions connect the UI to the database.

## Why the architecture is organized this way

This repo separates concerns so the same logic can be reused in multiple places. For example, session lookup is used by both API routes and server-rendered pages. Password hashing is centralized so it is not duplicated across login and registration. Database indexes are created from one place so the collections stay consistent.

The result is a codebase that is easier to extend once you understand the boundaries:

- UI components handle interaction and display.
- Server code handles security and persistence.
- Shared libraries hold reusable rules.

## How to use the rest of these reports

The other eight reports go deeper into specific systems. Read them in order if you want to rebuild the app from scratch. If you only care about one area, you can jump directly to that report.

## End-to-end workflow map

Every user-visible feature in this app follows the same broad route:

1. A browser page or form starts the request.
2. A client component or server action packages the input.
3. A route handler or server-side page receives the request.
4. Auth, CSRF, origin, and role checks happen before any database mutation.
5. Shared auth or utility libraries perform the actual business logic.
6. MongoDB stores or retrieves the data.
7. The server returns JSON, a redirect, or refreshed HTML.

That workflow repeats across login, dashboard management, QR flows, and any future feature you add.

## File groups to remember

- `src/app/` is where route entry points live.
- `src/lib/auth/` is where security and session rules live.
- `src/lib/http/` is where response helpers live.
- `src/proxy.ts` is where request-time routing and headers live.
- `src/components/` is where browser interaction lives.

If you can identify which group owns a piece of behavior, you can usually trace the whole request path from there.