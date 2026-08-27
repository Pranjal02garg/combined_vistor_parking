import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { verify } from "@node-rs/argon2";
import { z } from "zod";
import { authConfig, jwtCallback } from "./auth.config";
import { prisma } from "@/lib/server/prisma";
import { loginLimiter, allow } from "@/lib/server/ratelimit";
import { clientIp } from "@/lib/server/http";

// Node-only half: the Credentials provider verifies against the DB with Argon2id.
const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

// A real (but unusable) Argon2id hash, verified against on every "unknown
// email" login attempt so response timing can't be used to enumerate which
// emails have accounts — verify() always does the same expensive work either
// way, regardless of whether the email exists.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$Ahsl5uZ1VdNtHON3riTWcg$XAT8Dn2+uCTN1dzrtY1s2Ebti90dvX/w+/aVgBXy2nU";

// Google sign-in is restricted to this domain (when set) AND to emails that
// already have an active HEAD/STAFF account — see the `signIn` callback below.
const ALLOWED_GOOGLE_DOMAIN = process.env.ALLOWED_GOOGLE_DOMAIN ?? "";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw, request) => {
        const parsed = credentials.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        if (!(await allow(loginLimiter, clientIp(request)))) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { gates: { select: { id: true } } },
        });
        if (!user || !user.isActive) {
          await verify(DUMMY_HASH, password).catch(() => false);
          return null;
        }

        const valid = await verify(user.passwordHash, password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          gateIds: user.gates.map((g) => g.id),
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Credentials sign-ins are already fully verified in authorize() above.
    // Google sign-ins must match an active HEAD/STAFF account on the allowed
    // domain — no auto-provisioning, so account creation stays exclusively
    // an Admin (HEAD) action (see app/api/admin/users).
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;

      const email = user.email?.toLowerCase();
      if (!email) return false;
      if (ALLOWED_GOOGLE_DOMAIN && !email.endsWith(`@${ALLOWED_GOOGLE_DOMAIN}`)) return false;

      const dbUser = await prisma.user.findUnique({ where: { email } });
      if (!dbUser || !dbUser.isActive) return false;
      return dbUser.role === "HEAD" || dbUser.role === "STAFF";
    },
    // Credentials already supplies role/gateIds via the `user` object (handled
    // by jwtCallback). Google's profile doesn't carry those, so on a Google
    // sign-in we look the DB user up by email first, then delegate.
    async jwt(params) {
      const { token, account } = params;
      if (account?.provider === "google" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          include: { gates: { select: { id: true } } },
        });
        if (dbUser) {
          return jwtCallback({
            ...params,
            user: { id: dbUser.id, role: dbUser.role, gateIds: dbUser.gates.map((g) => g.id) } as any,
          });
        }
      }
      return jwtCallback(params);
    },
  },
});
