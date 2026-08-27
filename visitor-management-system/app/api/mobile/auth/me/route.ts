import { getMobileUser } from "@/lib/server/mobile-auth";
import { ok, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");

  return ok({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department || "Faculty",
      facultyId: user.facultyId || "FAC-001",
      phone: user.phone || null,
      parkingEligible: user.parkingEligible,
      eligibleFrom: user.eligibleFrom?.toISOString() || null,
      eligibleTill: user.eligibleTill?.toISOString() || null,
      allowedCars: user.vehicles.map((v) => ({
        id: v.id,
        plateNumber: v.plateNumber,
        stickerColor: v.stickerColor,
        vehicleType: v.vehicleType,
        modelName: v.modelName,
      })),
    },
  });
}
