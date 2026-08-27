import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getGuard();
  if (!session) return fail(401, "Not signed in");

  try {
    const events = await prisma.cameraEventLog.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        gate: {
          select: { name: true, code: true },
        },
      },
    });

    // Also get vehicle info for matched plates
    const plateNumbers = [...new Set(events.map((e) => e.plateNumber))];
    const vehicles = await prisma.facultyVehicle.findMany({
      where: { plateNumber: { in: plateNumbers } },
      include: {
        user: { select: { name: true, department: true } },
      },
    });

    const vehicleMap = new Map(vehicles.map((v) => [v.plateNumber, v]));

    const enrichedEvents = events.map((e) => {
      const v = vehicleMap.get(e.plateNumber);
      return {
        id: e.id,
        plateNumber: e.plateNumber,
        cameraType: e.cameraType,
        confidence: e.confidence,
        snapshotUrl: e.snapshotUrl,
        matched: e.matched,
        gateName: e.gate?.name || "Main Gate 1",
        gateCode: e.gate?.code || "1",
        driverName: v?.user.name || (e.matched ? "Authorized Faculty" : "Unknown Visitor"),
        department: v?.user.department || null,
        stickerColor: v?.stickerColor || (e.matched ? "green" : "gray"),
        modelName: v?.modelName || null,
        createdAt: e.createdAt.toISOString(),
      };
    });

    return ok({ events: enrichedEvents });
  } catch (err: any) {
    return fail(500, err?.message || "Failed to load ANPR feed");
  }
}
