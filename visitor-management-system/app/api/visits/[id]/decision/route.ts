import type { VisitStatus } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { decisionSchema } from "@/lib/validation/visit";
import { getSettings } from "@/lib/server/settings";

const NEXT_STATUS: Record<"approve" | "reject" | "escalate", VisitStatus> = {
  approve: "APPROVED",
  reject: "REJECTED",
  escalate: "ESCALATED",
};

// PATCH /api/visits/:id/decision — GUARD/HEAD. Approve / Reject / Escalate.
// Guards operate campus-wide: any operator may decide any pending visit (the
// entry gate stays as recorded at registration). State machine: only
// PENDING/ESCALATED can be decided.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const guard = await getGuard();
  if (!guard) return fail(401, "Not signed in");
  if (guard.role !== "GUARD" && guard.role !== "HEAD") {
    return fail(403, "Not permitted");
  }

  if (!(await allow(guardLimiter, guard.userId))) {
    return fail(429, "Too many requests");
  }

  const { id } = await params;
  if (!id || id.length > 64) return fail(400, "Bad id");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }
  const parsed = parseOr400(decisionSchema, body);
  if (!parsed.ok) return parsed.res;

  const visit = await prisma.visitLog.findUnique({
    where: { id },
    select: { status: true, visitorId: true, visitor: { select: { phone: true } } },
  });
  if (!visit) return fail(404, "Not found");
  if (visit.status !== "PENDING" && visit.status !== "ESCALATED") {
    return fail(409, "Visit already decided");
  }

  const nextStatus = NEXT_STATUS[parsed.data.action];

  if (nextStatus === "APPROVED") {
    const settings = await getSettings();
    if ((settings.featureFlags as any)?.lockdownActive) {
      return fail(403, "Lockdown is active. No new entries permitted.");
    }
    const { isPhoneBlacklisted } = await import("@/lib/server/blacklist");
    if (await isPhoneBlacklisted(visit.visitor.phone)) {
      return fail(403, "Cannot approve: this visitor is blacklisted.");
    }
  }

  // Atomic guarded update — re-checks status to win any race with another guard.
  const result = await prisma.visitLog.updateMany({
    where: { id, status: { in: ["PENDING", "ESCALATED"] } },
    data: {
      status: nextStatus,
      decidedById: guard.userId,
      onDutyGuard: parsed.data.onDutyGuard,
      approvedAt: nextStatus === "APPROVED" ? new Date() : undefined,
      exitedAt: nextStatus === "APPROVED" ? null : undefined,
      exitGateId: nextStatus === "APPROVED" ? null : undefined,
    },
  });
  if (result.count === 0) return fail(409, "Visit already decided");

  // P1.2: Update Visitor stats on approval
  if (nextStatus === "APPROVED") {
    await prisma.visitor.update({
      where: { id: visit.visitorId },
      data: {
        visitCount: { increment: 1 },
        lastVisitAt: new Date(),
      }
    });
  }

  return ok({ id, status: nextStatus });
}
