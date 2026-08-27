import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const session = await getGuard();
  if (!session) return fail(401, "Not signed in");

  const vehicles = await prisma.facultyVehicle.findMany({
    where: { userId: session.userId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return ok({ vehicles });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const session = await getGuard();
  if (!session) return fail(401, "Not signed in");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const { plateNumber, stickerColor, vehicleType, modelName } = body;

  if (!plateNumber || typeof plateNumber !== "string") {
    return fail(400, "License plate number is required");
  }

  const cleanPlate = plateNumber.toUpperCase().replace(/\s+/g, "").trim();

  // Validate Indian plate pattern: e.g. PB10AB1234, PB11BH8820, DL8CAA1234
  const plateRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
  if (!plateRegex.test(cleanPlate)) {
    return fail(400, "Invalid license plate format. Example: PB10AB1234 or PB11BH8820");
  }

  const validStickers = ["green", "red", "blue"];
  const color = validStickers.includes(stickerColor?.toLowerCase())
    ? stickerColor.toLowerCase()
    : "green";

  try {
    const existing = await prisma.facultyVehicle.findUnique({
      where: { plateNumber: cleanPlate },
    });

    if (existing) {
      if (existing.userId === session.userId) {
        if (!existing.isActive) {
          // Re-activate
          const updated = await prisma.facultyVehicle.update({
            where: { id: existing.id },
            data: { isActive: true, stickerColor: color, modelName: modelName || existing.modelName },
          });
          return ok({ vehicle: updated, message: "Vehicle re-activated in ANPR camera allowlist" });
        }
        return fail(400, `Vehicle ${cleanPlate} is already registered under your account.`);
      }
      return fail(400, `Vehicle ${cleanPlate} is already registered to another faculty member.`);
    }

    const vehicle = await prisma.facultyVehicle.create({
      data: {
        userId: session.userId,
        plateNumber: cleanPlate,
        stickerColor: color,
        vehicleType: vehicleType || "CAR",
        modelName: modelName || null,
        isActive: true,
      },
    });

    return ok({ vehicle, message: `Vehicle ${cleanPlate} registered and synced with ANPR cameras` }, { status: 201 });
  } catch (err: any) {
    return fail(500, err?.message || "Failed to register vehicle");
  }
}
