import { prisma } from "@/lib/server/prisma";
import { getGuard, canAccessGate } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const session = await getGuard();
  if (!session) return fail(401, "Not signed in");

  try {
    const body = await req.json();
    const { gateId, action, reason, plateNumber } = body;

    const gate = gateId
      ? await prisma.gate.findUnique({ where: { id: gateId } })
      : await prisma.gate.findFirst();

    if (!gate) return fail(404, "Gate not found");

    if (!canAccessGate(session, gate.id)) {
      return fail(403, "Not assigned to operate this gate");
    }

    const barrierLog = await prisma.barrierAccessLog.create({
      data: {
        userId: session.userId,
        gateId: gate.id,
        plateNumber: plateNumber ? plateNumber.toUpperCase().trim() : null,
        action: action === "CLOSE" ? "BARRIER_CLOSE" : "BARRIER_OPEN",
        method: "GUARD_OVERRIDE",
        status: "SUCCESS",
        details: {
          guardUserId: session.userId,
          reason: reason || "Manual Guard Console Override",
          gateName: gate.name,
        },
      },
    });

    return ok({
      success: true,
      message: `Barrier command (${action || "OPEN"}) dispatched to ${gate.name}`,
      log: barrierLog,
    });
  } catch (err: any) {
    return fail(500, err?.message || "Failed to trigger barrier");
  }
}
