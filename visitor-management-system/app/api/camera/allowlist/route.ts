import { prisma } from "@/lib/server/prisma";
import { ok, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vehicles = await prisma.facultyVehicle.findMany({
      where: {
        isActive: true,
        user: {
          isActive: true,
          parkingEligible: true,
        },
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            department: true,
            facultyId: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const allowedPlates = vehicles.map((v) => ({
      plateNumber: v.plateNumber,
      stickerColor: v.stickerColor,
      vehicleType: v.vehicleType,
      modelName: v.modelName,
      facultyName: v.user.name,
      facultyEmail: v.user.email,
      department: v.user.department || "Faculty",
      facultyId: v.user.facultyId || "FAC",
      allowed: true,
    }));

    return ok({
      count: allowedPlates.length,
      plates: allowedPlates,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return fail(500, err?.message || "Failed to load camera allowlist");
  }
}
