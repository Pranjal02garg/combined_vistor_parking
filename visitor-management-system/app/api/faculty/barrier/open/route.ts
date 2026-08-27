import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const session = await getGuard();
  if (!session) return fail(401, "Not signed in");

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const { gateCode, reason } = body;
  const code = String(gateCode || "1").replace("GATE_", "");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, parkingEligible: true, vehicles: { where: { isActive: true }, take: 1 } },
  });

  if (!user?.parkingEligible) {
    return fail(403, "Your campus parking permit is currently inactive or suspended.");
  }

  const primaryCar = user.vehicles[0];
  const gate = await prisma.gate.findUnique({ where: { code } }) || await prisma.gate.findFirst();

  // Log barrier trigger event
  const log = await prisma.barrierAccessLog.create({
    data: {
      userId: user.id,
      vehicleId: primaryCar?.id || null,
      gateId: gate?.id || null,
      plateNumber: primaryCar?.plateNumber || null,
      action: "BARRIER_OPEN",
      method: "REMOTE_1TAP",
      status: "SUCCESS",
      details: {
        reason: reason || `1-Tap Faculty Barrier Open at Gate ${code}`,
        stickerColor: primaryCar?.stickerColor || "green",
      },
    },
  });

  return ok({
    success: true,
    message: `Boom Barrier at ${gate?.name || "Gate " + code} opened successfully. Please proceed with caution.`,
    gateCode: code,
    gate: gate?.name || "Main Gate 1",
    logId: log.id,
    timestamp: new Date().toISOString(),
  });
}
