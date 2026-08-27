import { prisma } from "@/lib/server/prisma";
import { ok, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plateNumber, cameraType, gateCode, confidence, snapshotUrl } = body;

    if (!plateNumber) {
      return fail(400, "plateNumber is required");
    }

    const cleanPlate = plateNumber.toUpperCase().replace(/\s+/g, "").trim();
    const type = (cameraType || "ENTRY").toUpperCase();

    // Find gate by code if provided, otherwise default to Gate 1
    const gate = gateCode
      ? await prisma.gate.findUnique({ where: { code: String(gateCode) } })
      : await prisma.gate.findFirst();

    // Match plate with active faculty vehicles
    const vehicle = await prisma.facultyVehicle.findUnique({
      where: { plateNumber: cleanPlate },
      include: { user: true },
    });

    const isAuthorized = !!(
      vehicle &&
      vehicle.isActive &&
      vehicle.user.isActive &&
      vehicle.user.parkingEligible
    );

    // Log ANPR camera detection
    const cameraEvent = await prisma.cameraEventLog.create({
      data: {
        gateId: gate?.id || null,
        plateNumber: cleanPlate,
        cameraType: type,
        confidence: typeof confidence === "number" ? confidence : 0.95,
        snapshotUrl: snapshotUrl || null,
        matched: isAuthorized,
      },
    });

    if (isAuthorized && vehicle) {
      // Log Barrier Open Action
      await prisma.barrierAccessLog.create({
        data: {
          userId: vehicle.userId,
          vehicleId: vehicle.id,
          gateId: gate?.id || null,
          plateNumber: cleanPlate,
          action: "BARRIER_OPEN",
          method: "ANPR",
          status: "SUCCESS",
          details: {
            confidence: cameraEvent.confidence,
            cameraType: type,
            stickerColor: vehicle.stickerColor,
          },
        },
      });

      // Update parking lot occupancy count
      const defaultLot = await prisma.parkingLot.findFirst({ where: { isActive: true } });
      if (defaultLot) {
        if (type === "ENTRY") {
          await prisma.parkingLot.update({
            where: { id: defaultLot.id },
            data: {
              occupied: Math.min(defaultLot.totalCapacity, defaultLot.occupied + 1),
            },
          });
        } else if (type === "EXIT") {
          await prisma.parkingLot.update({
            where: { id: defaultLot.id },
            data: {
              occupied: Math.max(0, defaultLot.occupied - 1),
            },
          });
        }
      }

      return ok({
        status: "AUTHORIZED",
        barrierAction: "OPEN",
        plateNumber: cleanPlate,
        driver: vehicle.user.name,
        stickerColor: vehicle.stickerColor,
        cameraEventId: cameraEvent.id,
      });
    }

    return ok({
      status: "UNAUTHORIZED",
      barrierAction: "KEEP_CLOSED",
      plateNumber: cleanPlate,
      message: "Vehicle not in authorized parking allowlist or permit inactive",
      cameraEventId: cameraEvent.id,
    });
  } catch (err: any) {
    return fail(500, err?.message || "Internal camera event processing error");
  }
}
