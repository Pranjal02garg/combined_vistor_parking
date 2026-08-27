import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const session = await getGuard();
  if (!session) return fail(401, "Not signed in");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const { gateCode, reason } = body;

  const validGates = ["1", "2", "3", "4", "GATE_1", "GATE_2", "GATE_3", "GATE_4"];
  const code = String(gateCode || "1").replace("GATE_", "");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, parkingEligible: true, vehicles: { where: { isActive: true }, take: 1 } },
  });

  if (!user?.parkingEligible) {
    return fail(403, "Your campus parking permit is currently inactive or suspended.");
  }

  const primaryCar = user.vehicles[0];

  // Log barrier trigger event
  const log = await prisma.barrierAccessLog.create({
    data: {
      gateCode: code,
      triggeredBy: "FACULTY_APP_PULSE",
      userId: user.id,
      plateNumber: primaryCar?.plateNumber || null,
      stickerColor: primaryCar?.stickerColor || "green",
      reason: reason || `1-Tap Faculty Barrier Open at Gate ${code}`,
      status: "SUCCESS",
    },
  });

  return ok({
    success: true,
    message: `Boom Barrier at Gate ${code} opened successfully. Please proceed with caution.`,
    gateCode: code,
    logId: log.id,
    timestamp: new Date().toISOString(),
  });
}
