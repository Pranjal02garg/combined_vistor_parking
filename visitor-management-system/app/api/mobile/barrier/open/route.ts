import { prisma } from "@/lib/server/prisma";
import { getMobileUser } from "@/lib/server/mobile-auth";
import { ok, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");

  if (!user.parkingEligible) {
    return fail(403, "Your campus parking permit is inactive or suspended.");
  }

  const vehicle = user.vehicles?.[0];
  const gate = await prisma.gate.findFirst();

  const log = await prisma.barrierAccessLog.create({
    data: {
      userId: user.id,
      vehicleId: vehicle?.id || null,
      gateId: gate?.id || null,
      plateNumber: vehicle?.plateNumber || null,
      action: "BARRIER_OPEN",
      method: "REMOTE_1TAP",
      status: "SUCCESS",
      details: {
        triggeredBy: user.name,
        facultyId: user.facultyId,
        platform: "MOBILE_APP",
      },
    },
  });

  return ok({
    success: true,
    message: "Barrier open command sent to Main Gate.",
    gate: gate?.name || "Main Gate 1",
    logId: log.id,
    timestamp: new Date().toISOString(),
  });
}
