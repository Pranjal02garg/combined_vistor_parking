import { prisma } from "@/lib/server/prisma";
import { getMobileUser } from "@/lib/server/mobile-auth";
import { ok, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");

  const lots = await prisma.parkingLot.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return ok({
    lots: lots.map((l) => ({
      id: l.id,
      name: l.name,
      code: l.code,
      zone: l.zone,
      totalCapacity: l.totalCapacity,
      occupied: l.occupied,
      freeSlots: Math.max(0, l.totalCapacity - l.occupied),
      reservedFaculty: l.reservedFaculty,
      occupancyPercentage: Math.round((l.occupied / l.totalCapacity) * 100),
    })),
  });
}
