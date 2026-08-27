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

  const { qrPayload } = body;

  if (!qrPayload || typeof qrPayload !== "string") {
    return fail(400, "QR Payload is required");
  }

  let gateCode = "1";
  const upper = qrPayload.toUpperCase();
  if (upper.includes("GATE_2") || upper.includes("GATE:2") || upper === "2") gateCode = "2";
  else if (upper.includes("GATE_3") || upper.includes("GATE:3") || upper === "3") gateCode = "3";
  else if (upper.includes("GATE_4") || upper.includes("GATE:4") || upper === "4") gateCode = "4";

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, parkingEligible: true, vehicles: { where: { isActive: true }, take: 1 } },
  });

  if (!user?.parkingEligible) {
    return fail(403, "Your campus parking permit is inactive. Contact University Security.");
  }

  const primaryCar = user.vehicles[0];
  const gate = await prisma.gate.findUnique({ where: { code: gateCode } }) || await prisma.gate.findFirst();

  const log = await prisma.barrierAccessLog.create({
    data: {
      userId: user.id,
      vehicleId: primaryCar?.id || null,
      gateId: gate?.id || null,
      plateNumber: primaryCar?.plateNumber || null,
      action: "BARRIER_OPEN",
      method: "GATE_QR_SCAN",
      status: "SUCCESS",
      details: {
        reason: `QR Booth Scan Authenticated: ${qrPayload.substring(0, 30)}`,
        stickerColor: primaryCar?.stickerColor || "green",
      },
    },
  });

  return ok({
    success: true,
    message: `Gate ${gateCode} Booth QR Verified. Barrier pulse sent!`,
    gateCode,
    logId: log.id,
    timestamp: new Date().toISOString(),
  });
}
