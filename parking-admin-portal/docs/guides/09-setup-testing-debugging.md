# Report 9: Setup, Testing, and Debugging

This report explains how to run the project locally, how to test it, and what to check when something fails.

## Local setup

The project uses a standard Node.js workflow. At a minimum, you need:

- Node.js,
- MongoDB,
- the correct environment variables,
- and the project dependencies installed.

The app expects values such as the MongoDB connection string and app origin to be configured in the environment.

## Running the app

The usual local flow is:

1. Install dependencies.
2. Configure the environment.
3. Start the dev server.
4. Open the app in the browser.

## How to test the important flows

For a beginner, the most useful checks are:

- register a user,
- log in,
- confirm session persistence on refresh,
- log out,
- open the dashboard as an authenticated admin,
- and check that unauthenticated dashboard access redirects to login.

## Common debugging areas

When something breaks, look at these areas first:

- MongoDB connection issues in `src/lib/mongodb.ts`,
- environment validation in `src/lib/env.ts`,
- auth session lookup in `src/lib/auth/service.ts`,
- route protection in `src/proxy.ts`,
- and form validation in the relevant page or route handler.

## What errors usually mean

- If login fails, the issue is often password policy, CSRF, or user state.
- If dashboard access redirects unexpectedly, the session cookie may be missing or invalid.
- If database data does not show up, check collection names, indexes, and environment configuration.

## Beginner takeaway

Debugging this app means tracing the request path from browser to route handler to service layer to MongoDB and back. Once you can follow that path, most bugs become understandable.

## How to debug by request path

When a feature fails, trace it in this order:

1. The browser component that started the request.
2. The route or server action that receives it.
3. The validation layer that rejects bad input.
4. The auth and request guard layers.
5. The service file that queries or mutates MongoDB.
6. The response helper that formats the output.

That gives you a repeatable debugging process instead of guesswork.

## Useful file stack for beginners

- `src/components/credentials-form.tsx`
- `src/app/api/auth/login/route.ts`
- `src/lib/auth/request.ts`
- `src/lib/auth/csrf.ts`
- `src/lib/auth/service.ts`
- `src/lib/mongodb.ts`
- `src/proxy.ts`

Reading those files together shows almost every important control point in the app.