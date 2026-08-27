import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const session = await getGuard();
  if (!session) return fail(401, "Not signed in");

  const { id } = await params;

  const vehicle = await prisma.facultyVehicle.findUnique({
    where: { id },
  });

  if (!vehicle) {
    return fail(404, "Vehicle not found");
  }

  if (vehicle.userId !== session.userId && session.role !== "HEAD") {
    return fail(403, "Not authorized to delete this vehicle");
  }

  await prisma.facultyVehicle.delete({
    where: { id },
  });

  return ok({ success: true, message: `Vehicle ${vehicle.plateNumber} removed from ANPR allowlist` });
}
