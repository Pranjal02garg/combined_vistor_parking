import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "./prisma";

export interface GuardSession {
  userId: string;
  role: Role;
  gateIds: string[];
}

/** Returns the authenticated staff session, or null if not signed in. */
export async function getGuard(): Promise<GuardSession | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  let userId = session.user.id;
  let role = session.user.role;
  let gateIds = session.user.gateIds ?? [];

  if (session.user.email) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
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
    role,
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
