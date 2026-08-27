import { prisma } from "@/lib/server/prisma";
import { getMobileUser } from "@/lib/server/mobile-auth";
import { ok, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");

  const cars = await prisma.facultyVehicle.findMany({
    where: { userId: user.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return ok({ cars });
}

export async function POST(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");

  try {
    const { plateNumber, stickerColor, vehicleType, modelName } = await req.json();

    if (!plateNumber) return fail(400, "License plate number is required");
    const cleanPlate = plateNumber.toUpperCase().replace(/\s+/g, "").trim();

    const plateRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
    if (!plateRegex.test(cleanPlate)) {
      return fail(400, "Invalid license plate format (e.g. PB11BH8820 or DL8CAA1234)");
    }

    const existing = await prisma.facultyVehicle.findUnique({
      where: { plateNumber: cleanPlate },
    });

    if (existing) {
      if (existing.userId === user.id) {
        const updated = await prisma.facultyVehicle.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            stickerColor: stickerColor || existing.stickerColor,
            modelName: modelName || existing.modelName,
          },
        });
        return ok({ car: updated, message: "Vehicle re-activated and synced" });
      }
      return fail(400, "Plate is already registered to another user");
    }

    const car = await prisma.facultyVehicle.create({
      data: {
        userId: user.id,
        plateNumber: cleanPlate,
        stickerColor: stickerColor || "green",
        vehicleType: vehicleType || "CAR",
        modelName: modelName || null,
        isActive: true,
      },
    });

    return ok({ car, message: "Vehicle registered successfully" }, { status: 201 });
  } catch (err: any) {
    return fail(500, err?.message || "Failed to register vehicle");
  }
}
