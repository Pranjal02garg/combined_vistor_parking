# Report 7: Dashboard and Admin Workflows

This report explains the admin-facing workflows beyond basic login.

## Dashboard purpose

The dashboard is the operator console for the parking system. It is where admins can view users, create users, toggle user status, and manage parking access or vehicle information.

## Data loading

The dashboard page fetches users from MongoDB server-side. That means the page can render with real data without waiting for a client-side API call.

## Admin permissions

Admin-only actions are protected on the server. The page checks whether the current authenticated user is an admin before allowing sensitive mutations.

## User creation flow

The dashboard includes a form path for creating managed users. The server-side action validates:

- required fields,
- email format,
- password strength,
- duplicate email conflicts,
- parking eligibility options,
- and vehicle details.

After the user is created, the page is revalidated so the UI refreshes with the newest data.

## Vehicle management flow

The dashboard also supports adding and removing vehicles tied to users. The system stores allowed cars as structured data attached to each user record and records changes in a separate audit-style collection.

## Status toggles

Two common admin actions are:

- toggling whether a user is active,
- toggling whether parking access is allowed.

Those actions are represented as form submissions or action buttons that send the relevant email and next state to the server.

## Beginner takeaway

The dashboard is not just a table. It is the operational layer where the business rules of the app are applied to real records.

## Full dashboard workflow

The dashboard path is:

1. `src/proxy.ts` checks whether the request has a session cookie.
2. `src/app/dashboard/page.tsx` runs on the server and calls `getCurrentAuth()`.
3. `src/lib/auth/service.ts` resolves the session and user from MongoDB.
4. `src/app/dashboard/page.tsx` fetches user rows from the `users` collection.
5. The page passes data and server actions into `src/app/dashboard/users-table.tsx`.
6. The table renders filters and action buttons in the browser.
7. Server actions mutate records and call `revalidatePath("/dashboard")`.

That sequence shows how the dashboard combines route protection, server rendering, and client interactivity.

## File map for admin actions

- `src/app/dashboard/page.tsx` coordinates data loading and server actions.
- `src/app/dashboard/users-table.tsx` handles display, filtering, and button clicks.
- `src/components/create-user-form.tsx` collects admin user-creation input.
- `src/components/add-vehicle-form.tsx` and `src/components/remove-vehicle-form.tsx` manage vehicle forms.
- `src/lib/auth/service.ts` enforces auth and session checks.
- `src/lib/mongodb.ts` provides the database connection.

Read those together to understand the full admin workflow.