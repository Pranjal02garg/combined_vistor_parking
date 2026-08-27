# Report 2: Next.js Mental Model in This Repository

This report explains the Next.js concepts used in the codebase. The app uses the App Router, route handlers, server components, client components, server actions, and `proxy.ts`.

## App Router basics

In the App Router, folders under `src/app/` become routes. For example:

- `src/app/login/page.tsx` becomes `/login`
- `src/app/register/page.tsx` becomes `/register`
- `src/app/dashboard/page.tsx` becomes `/dashboard`
- `src/app/api/auth/login/route.ts` becomes `/api/auth/login`

Pages are not just HTML files. They are React modules that can run on the server, the client, or both.

## Server components and client components

By default, components in the App Router are server components. A file marked with `"use client"` runs in the browser and can use React state, effects, and event handlers.

In this repo:

- `src/app/dashboard/users-table.tsx` is a client component because it uses state and interactive buttons.
- Form components in `src/components/` are client-side interactive pieces.
- Pages like `src/app/dashboard/page.tsx` can stay server-side and fetch data directly from MongoDB.

This split matters because server components can securely access the database, while client components are better for user interaction.

## Route handlers

Route handlers live in `route.ts` files. They are the backend endpoints of the application. They receive `Request` or `NextRequest`, validate data, interact with the database, and return `Response` or `NextResponse`.

This repository uses route handlers for auth, QR, barrier, mobile, and user endpoints.

## Server actions

Server actions let forms call server code directly without building a separate API endpoint. In `src/app/dashboard/page.tsx`, some form handlers are marked with `"use server"`. That means the form submission can trigger database updates and redirects from the server.

This is useful when the action belongs tightly to one page and does not need to be exposed as a public API.

## `proxy.ts`

The file `src/proxy.ts` runs before requests reach pages. It is used here to:

- block unauthenticated access to protected routes like `/dashboard`,
- redirect users to `/login` if needed,
- and add security headers to the response.

For a beginner, the key lesson is that `proxy.ts` is not the same thing as frontend navigation. It is a server-side gate in front of requests.

## Rendering model to remember

When you read any page in this project, ask three questions:

1. Does it run on the server or the client?
2. Does it read data directly from MongoDB or from an API?
3. Does it mutate data through a server action or a route handler?

That mental model explains most of the codebase.

## Request path by file type

Here is how a request is processed through the main Next.js file types in this repo:

- `page.tsx`: produces the page UI and may fetch server data.
- `route.ts`: acts as the HTTP endpoint for API calls.
- `"use client"` component: handles user interaction in the browser.
- `"use server"` action: runs on the server after a form submission.
- `proxy.ts`: intercepts requests before they reach the page or route.

The beginner mistake is to think every file is just React UI. In this codebase, many files are server entry points.

## Example trace

For a login page load and submit:

1. The browser opens `/login`.
2. `src/app/login/page.tsx` renders the login page.
3. `src/components/credentials-form.tsx` loads a CSRF token from `/api/auth/csrf`.
4. The form submits to `/api/auth/login`.
5. `src/app/api/auth/login/route.ts` validates and authenticates the request.
6. The route delegates to `src/lib/auth/service.ts` and related auth libraries.
7. The response sets a cookie and the browser navigates to `/dashboard`.

That is the core pattern repeated throughout the app.