import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "./prisma";
import { cookies } from "next/headers";
import { decode } from "@auth/core/jwt";

export interface GuardSession {
  userId: string;
  role: Role;
  gateIds: string[];
}

/** Returns the authenticated staff session, or null if not signed in. */
export async function getGuard(): Promise<GuardSession | null> {
  let session = await auth().catch(() => null);

  let userId = session?.user?.id;
  let role = session?.user?.role;
  let gateIds = session?.user?.gateIds ?? [];
  let email = session?.user?.email;

  if (!userId) {
    try {
      const cookieStore = await cookies();
      const rawToken =
        cookieStore.get("authjs.session-token")?.value ||
        cookieStore.get("__Secure-authjs.session-token")?.value ||
        cookieStore.get("next-auth.session-token")?.value;

      if (rawToken) {
        const secret = process.env.AUTH_SECRET || "dev-secret-key-campus-vms-super-secret-key-32-bytes!";
        const decoded: any = await decode({
          token: rawToken,
          secret,
          salt: "authjs.session-token",
        }).catch(() => null);

        if (decoded?.uid) {
          userId = decoded.uid;
          role = decoded.role;
          gateIds = decoded.gateIds || [];
          email = decoded.email;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!userId) return null;

  if (email) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true, gates: { select: { id: true } } },
      });
      if (dbUser) {
        userId = dbUser.id;
        role = dbUser.role;
        gateIds = dbUser.gates.map((g) => g.id);
      }
    } catch {
      // ignore DB transient error and fallback to JWT
    }
  }

  return {
    userId,
    role: role as Role,
    gateIds,
  };
}

/** HEAD is not gate-scoped and has campus-wide authority. */
export function isPrivileged(role: Role): boolean {
  return role === "HEAD";
}

export const isHead = (role: Role) => role === "HEAD";
export const isStaff = (role: Role) => role === "STAFF";
export const isGuard = (role: Role) => role === "GUARD";

/**
 * Core IDOR check: a plain guard may only touch a gate they're assigned to;
 * privileged roles may touch any gate.
 */
export function canAccessGate(s: GuardSession, gateId: string): boolean {
  return isPrivileged(s.role) || s.gateIds.includes(gateId);
}
