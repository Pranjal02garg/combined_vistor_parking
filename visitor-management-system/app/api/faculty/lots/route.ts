import { prisma } from "@/lib/server/prisma";
import { ok, fail, sameOrigin } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  let lots = await prisma.parkingLot.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  if (lots.length === 0) {
    await prisma.parkingLot.createMany({
      data: [
        { name: "Faculty Lot S4", code: "LOT_S4", zone: "S4", totalCapacity: 50, occupied: 24, reservedFaculty: 30 },
        { name: "Main Admin Lot", code: "LOT_ADMIN", zone: "ADMIN", totalCapacity: 35, occupied: 18, reservedFaculty: 20 },
        { name: "Engineering Lot E4", code: "LOT_E4", zone: "E4", totalCapacity: 60, occupied: 38, reservedFaculty: 35 },
      ],
    });
    lots = await prisma.parkingLot.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }

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
