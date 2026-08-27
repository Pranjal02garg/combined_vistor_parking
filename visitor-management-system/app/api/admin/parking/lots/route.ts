import { prisma } from "@/lib/server/prisma";
import { getGuard, isHead } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getGuard();
  if (!session || !isHead(session.role)) {
    return fail(403, "HEAD authority required");
  }

  const lots = await prisma.parkingLot.findMany({ orderBy: { name: "asc" } });
  return ok({ lots });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const session = await getGuard();
  if (!session || !isHead(session.role)) {
    return fail(403, "HEAD authority required");
  }

  try {
    const body = await req.json();
    const { id, name, code, zone, totalCapacity, occupied, reservedFaculty, isActive } = body;

    if (!name || !code) {
      return fail(400, "Name and code are required");
    }

    if (id) {
      const updated = await prisma.parkingLot.update({
        where: { id },
        data: {
          name,
          code: code.toUpperCase().trim(),
          zone: (zone || "GENERAL").toUpperCase().trim(),
          totalCapacity: Number(totalCapacity) || 50,
          occupied: Math.min(Number(totalCapacity) || 50, Number(occupied) || 0),
          reservedFaculty: Number(reservedFaculty) || 0,
          isActive: typeof isActive === "boolean" ? isActive : true,
        },
      });
      return ok({ lot: updated, message: "Parking lot updated" });
    }

    const created = await prisma.parkingLot.create({
      data: {
        name,
        code: code.toUpperCase().trim(),
        zone: (zone || "GENERAL").toUpperCase().trim(),
        totalCapacity: Number(totalCapacity) || 50,
        occupied: Number(occupied) || 0,
        reservedFaculty: Number(reservedFaculty) || 0,
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
    });

    return ok({ lot: created, message: "Parking lot created" }, { status: 201 });
  } catch (err: any) {
    return fail(500, err?.message || "Failed to save parking lot");
  }
}
