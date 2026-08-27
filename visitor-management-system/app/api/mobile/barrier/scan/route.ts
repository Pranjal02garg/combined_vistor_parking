import { prisma } from "@/lib/server/prisma";
import { getMobileUser } from "@/lib/server/mobile-auth";
import { ok, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");

  if (!user.parkingEligible) {
    return fail(403, "Your campus parking permit is inactive.");
  }

  const { qrPayload } = await req.json();
  if (!qrPayload) return fail(400, "Missing QR payload");

  // Format: GATE_PASS_GATE_1 or gate id
  let gateCode = "1";
  if (qrPayload.includes("GATE_")) {
    const parts = qrPayload.split("GATE_");
    gateCode = parts[parts.length - 1];
  }

  const gate = await prisma.gate.findUnique({ where: { code: gateCode } }) ||
               await prisma.gate.findFirst();

  const vehicle = user.vehicles?.[0];

  const log = await prisma.barrierAccessLog.create({
    data: {
      userId: user.id,
      vehicleId: vehicle?.id || null,
      gateId: gate?.id || null,
      plateNumber: vehicle?.plateNumber || null,
      action: "BARRIER_OPEN",
      method: "GATE_QR_SCAN",
      status: "SUCCESS",
      details: {
        gateCode,
        facultyName: user.name,
        platform: "MOBILE_APP_SCAN",
      },
    },
  });

  return ok({
    success: true,
    message: `Barrier opened for ${gate?.name || "Gate " + gateCode}`,
    gateName: gate?.name,
    logId: log.id,
  });
}
