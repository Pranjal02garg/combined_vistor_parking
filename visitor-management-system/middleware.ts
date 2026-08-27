import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge middleware built from the DB-free config. It enforces the `authorized`
// callback (currently gating /admin). API routes additionally re-check auth and
// authorization in-handler — middleware is the outer, not the only, layer.
//
// /head, /staff and /guard are intentionally NOT in the matcher: each renders
// its own branded sign-in screen for anonymous visitors, and /guard is itself
// `pages.signIn`, so gating it here would redirect it to itself in a loop.
// See the `authorized` callback in auth.config.ts for the full reasoning.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Run on dashboard pages; skip static assets and the auth endpoints.
  matcher: ["/admin/:path*"],
};
