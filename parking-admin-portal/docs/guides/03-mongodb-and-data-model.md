# Report 3: MongoDB Connection and Data Model

This report explains how the app connects to MongoDB and how the core collections are structured.

## Database connection

The shared connection lives in `src/lib/mongodb.ts`. It creates one reusable `MongoClient` promise and returns a `Db` object through `getDb()`.

The point of this pattern is to avoid reconnecting on every request. In a Next.js server environment, especially during development, repeated connections can become noisy or slow.

## Environment-based configuration

The MongoDB URI and database name are loaded from environment variables. That lets the same code run locally and in production without changing source code.

## Main collections

The auth service currently relies on these collections:

- `users`
- `sessions`

The dashboard and parking workflows also reference other collections such as `car_changes` and QR-related collections in other parts of the app.

## User document shape

Users store identity, access state, and parking data together. A user record includes fields such as:

- name and email,
- role,
- active status,
- parking eligibility,
- eligible date range,
- allowed cars,
- failed login attempts,
- lockout time,
- timestamps.

The important beginner lesson is that the app does not keep users in memory. The user record is the source of truth.

## Session document shape

Sessions are stored server-side in MongoDB. The browser only gets a raw session token in a cookie. The database stores a hash of that token plus metadata like:

- user ID,
- creation time,
- expiry time,
- last seen time,
- IP address,
- user agent.

That design means the server can invalidate a session by deleting the database row. A stolen cookie becomes useless once the session is removed.

## Indexes

The auth service creates indexes automatically. The important ones are:

- unique index on `users.email`
- unique index on `sessions.tokenHash`
- index on `sessions.userId`
- TTL index on `sessions.expiresAt`

TTL indexes are important because expired sessions are cleaned up automatically by MongoDB.

## How data is queried

Queries are written with the MongoDB Node driver. Typical patterns in this repo include:

- `findOne` for a single user or session,
- `insertOne` for new users or sessions,
- `updateOne` for profile and eligibility changes,
- `deleteOne` for logout and session invalidation,
- `find().sort().toArray()` for dashboard lists.

## Beginner takeaway

If you are trying to rebuild this project, MongoDB is used for both authentication state and business state. That is why the database layer is central to the entire app, not just a background utility.

## File-by-file data path

When data needs to be read or written, the request usually travels through these files in this order:

1. A page or route decides it needs data.
2. `src/lib/mongodb.ts` supplies the shared `Db` connection.
3. A feature-specific service file, usually under `src/lib/auth/`, performs the query.
4. The route handler or server action maps the result into a response.

For example, login uses `src/lib/auth/service.ts` to find the user, create the session, and update the session cookie. The dashboard uses the same database connection pattern to read users and update parking-related fields.

## Why the connection helper matters

Without a shared connection helper, every request would open its own client connection logic. That creates unnecessary overhead and makes the app harder to reason about. Centralizing the connection means the rest of the code can focus on business rules rather than database plumbing.