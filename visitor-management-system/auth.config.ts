import type { NextAuthConfig } from "next-auth";

type Callbacks = NonNullable<NextAuthConfig["callbacks"]>;

// Persist role + assigned gate ids into the JWT on sign-in. Exported so
// auth.ts can delegate to it after enriching the token for non-Credentials
// providers (e.g. Google, which has no `role`/`gateIds` of its own).
export const jwtCallback: NonNullable<Callbacks["jwt"]> = ({ token, user }) => {
  if (user) {
    token.uid = user.id;
    token.role = user.role;
    token.gateIds = user.gateIds;
  }
  return token;
};

// Expose them on the session for server + client reads.
export const sessionCallback: NonNullable<Callbacks["session"]> = ({ session, token }) => {
  if (session.user) {
    session.user.id = token.uid as string;
    session.user.role = token.role as typeof session.user.role;
    session.user.gateIds = (token.gateIds as string[]) ?? [];
  }
  return session;
};

// Edge-safe half of the auth setup: NO database or native crypto here, so it can
// run inside `middleware.ts` on the edge runtime. The Credentials provider (which
// touches Prisma + argon2) is added in `auth.ts`, which runs only in Node.
export const authConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [], // filled in by auth.ts
  callbacks: {
    jwt: jwtCallback,
    session: sessionCallback,
    // Gate dashboard pages at the edge; API routes re-check in-handler.
    // NOTE: /head, /staff and /guard are deliberately NOT included here even
    // though they're "dashboards" — each hosts its own branded login screen
    // for anonymous visitors (and /guard IS `pages.signIn` itself), so an
    // edge-level redirect-when-signed-out would either loop (/guard redirects
    // to /guard) or silently swap in the wrong branded login page. No real
    // data is at risk from that page-shell being reachable: every API route
    // under /api re-checks auth/role itself (see lib/server/session.ts).
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const onAdmin = request.nextUrl.pathname.startsWith("/admin");
      if (onAdmin) return isLoggedIn;
      return true;
    },
  },
} satisfies NextAuthConfig;
