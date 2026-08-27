import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const session = await getGuard();
  if (!session) return fail(401, "Not signed in");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      facultyId: true,
      phone: true,
      alternateContact: true,
      parkingEligible: true,
      eligibleFrom: true,
      eligibleTill: true,
      vehicles: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) return fail(404, "User not found");

  // Ensure default parking lots exist
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

  const barrierLogs = await prisma.barrierAccessLog.findMany({
    where: { userId: user.id },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  const recentPasses = await prisma.vIPPass.findMany({
    where: { hostStaffId: user.id },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  return ok({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || "Computer Science & Engineering",
      facultyId: user.facultyId || "#TH-CSE-4092",
      phone: user.phone || "+91 98765 43210",
      alternateContact: user.alternateContact || "+91 98765 00000",
      parkingEligible: user.parkingEligible,
      eligibleFrom: user.eligibleFrom || new Date("2026-01-01"),
      eligibleTill: user.eligibleTill || new Date("2027-12-31"),
      defaultSticker: user.vehicles[0]?.stickerColor || "green",
    },
    vehicles: user.vehicles,
    lots: lots.map((l) => ({
      id: l.id,
      name: l.name,
      code: l.code,
      zone: l.zone,
      totalCapacity: l.totalCapacity,
      occupied: l.occupied,
      freeSlots: Math.max(0, l.totalCapacity - l.occupied),
      reservedFaculty: l.reservedFaculty,
    })),
    recentBarrierLogs: barrierLogs,
    recentPasses,
  });
}
