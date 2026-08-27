import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { exitSchema } from "@/lib/validation/visit";

// POST /api/visits/exit — GUARD/HEAD. Mark a visitor's (cross-gate) exit at the
// gate the operator is manning. Any operator may process an exit at any active
// gate; the visit must actually be APPROVED (inside) or we 409.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const guard = await getGuard();
  if (!guard) return fail(401, "Not signed in");
  if (guard.role !== "GUARD" && guard.role !== "HEAD") {
    return fail(403, "Not permitted");
  }

  if (!(await allow(guardLimiter, guard.userId))) {
    return fail(429, "Too many requests");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }
  const parsed = parseOr400(exitSchema, body);
  if (!parsed.ok) return parsed.res;
  const { referenceCode, exitGateId } = parsed.data;

  const gate = await prisma.gate.findFirst({
    where: { id: exitGateId, isActive: true },
    select: { id: true },
  });
  if (!gate) return fail(400, "Unknown gate");

  const visit = await prisma.visitLog.findUnique({
    where: { referenceCode },
    select: { status: true, approvedAt: true, visitorId: true, category: true },
  });
  if (!visit) return fail(404, "Not found");
  if (visit.status !== "APPROVED") {
    return fail(409, "Visitor is not currently inside");
  }

  const exitedAt = new Date();
  const result = await prisma.visitLog.updateMany({
    where: { referenceCode, status: "APPROVED" },
    data: {
      status: "EXITED",
      exitedAt,
      exitGateId,
      exitedById: guard.userId,
    },
  });
  if (result.count === 0) return fail(409, "Visitor is not currently inside");

  // Increment overstayCount if limit was exceeded
  try {
    const { getSettings } = await import("@/lib/server/settings");
    const settings = await getSettings();
    if (visit.approvedAt) {
      const elapsedMinutes = Math.floor(
        (exitedAt.getTime() - visit.approvedAt.getTime()) / (1000 * 60)
      );
      const categoryConfig = await prisma.formCategory.findUnique({
        where: { key: visit.category },
        select: { overstayMinutes: true }
      });
      
      const { isOverstayTracked } = await import("@/lib/server/overstay");
      if (isOverstayTracked(visit.category)) {
        const threshold = categoryConfig?.overstayMinutes ?? 120;
        
        if (elapsedMinutes > threshold) {
          await prisma.visitor.update({
            where: { id: visit.visitorId },
            data: {
              overstayCount: { increment: 1 },
            },
          });
        }
      }
    }
  } catch {
    // Fail silently on settings loading errors to ensure checkout succeeds
  }

  return ok({ referenceCode, status: "EXITED" });
}
