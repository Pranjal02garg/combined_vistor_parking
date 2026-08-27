# Report 6: Frontend Pages and Components

This report explains the React side of the project: pages, client components, forms, and the dashboard UI.

## Main pages

The primary pages are:

- `/` home page
- `/login`
- `/register`
- `/dashboard`

Each page has a different job. The login and register pages collect credentials, while the dashboard displays users and admin actions.

## Client component usage

Client components are used where the browser needs interaction, state, or transitions. For example, `src/app/dashboard/users-table.tsx` uses React state to filter rows and buttons to trigger admin actions.

## Forms and actions

The UI uses forms for user creation and vehicle management. Some actions submit to server actions, which lets the app mutate server state without building a separate fetch layer in every place.

## The dashboard table

The users table shows a lot of business data at once:

- name and email,
- role,
- active status,
- parking access,
- allowed cars,
- eligibility dates,
- action buttons.

That table is intentionally busy because it is the main admin view. The search box filters rows in memory on the client for a fast experience.

## Component design pattern

The component layer follows a simple pattern:

- pages fetch or prepare data,
- components display it,
- forms submit changes,
- and buttons trigger state updates.

That separation keeps the UI understandable even when the business logic gets more complex.

## Beginner takeaway

If you are new to React, focus on state, props, events, and composition. Those four ideas explain most of the frontend code in this repo.

## Browser workflow for the login form

The login/register UI is not just visual. It actively manages the request flow:

1. `src/components/credentials-form.tsx` mounts in the browser.
2. It fetches a CSRF token from `/api/auth/csrf`.
3. The user types email and password into controlled inputs.
4. On submit, the component calls the correct auth endpoint.
5. The server responds with either an error message or a session.
6. On success, the router replaces the current page and refreshes state.

## Browser workflow for the dashboard table

The dashboard table is another good example:

1. `src/app/dashboard/page.tsx` fetches users on the server.
2. It passes those users into `src/app/dashboard/users-table.tsx`.
3. The client component filters the list locally as the user types.
4. Button clicks submit form data to server actions.
5. The server updates MongoDB and revalidates the page.

If you can follow those two flows, the rest of the frontend becomes much easier to understand.