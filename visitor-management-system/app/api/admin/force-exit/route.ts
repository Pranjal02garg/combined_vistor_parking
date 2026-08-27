import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const head = await getGuard();
  if (head?.role !== "HEAD") return fail(403, "HEAD only");
  if (!head) return fail(401, "Not signed in");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  if (!body.visitId || !body.reason) {
    return fail(400, "Missing visitId or reason");
  }

  const visit = await prisma.visitLog.findUnique({
    where: { id: body.visitId }
  });

  if (!visit) return fail(404, "Visit not found");
  if (visit.status === "EXITED") return fail(400, "Already exited");

  await prisma.visitLog.update({
    where: { id: body.visitId },
    data: {
      status: "EXITED",
      exitedAt: new Date(),
      exitReason: `Force Exit: ${body.reason}`,
      exitedById: head.userId
    }
  });

  if (visit.visitorId) {
    await prisma.visitor.update({
      where: { id: visit.visitorId },
      data: { overstayCount: { increment: 1 } }
    });
  }

  await prisma.auditLog.create({
    data: {
      action: "FORCE_EXIT",
      entityType: "VisitLog",
      entityId: body.visitId,
      actorId: head.userId,
      details: { reason: body.reason, originalStatus: visit.status }
    }
  });

  return ok({ success: true });
}
