import { NextResponse } from "next/server";

import { getDb } from "@/lib/mongodb";
import type { UserDocument } from "@/lib/auth/types";

function cleanPlate(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export async function GET() {
  try {
    const db = await getDb();

    const users = await db
      .collection<UserDocument>("users")
      .find({
        isActive: true,
        parkingEligible: true,
      })
      .project({
        allowedCars: 1,
      })
      .toArray();

    type AllowedCar = {
      plateNumber?: string;
    };

    const plates = users.flatMap((user) =>
      ((user.allowedCars ?? []) as AllowedCar[])
        .map((car: AllowedCar) => cleanPlate(car.plateNumber))
        .filter(Boolean),
    );

    return NextResponse.json({
      plates,
    });
  } catch (error) {
    console.error("Failed to fetch allowed plates:", error);

    return NextResponse.json(
      { error: "Failed to fetch allowed plates" },
      { status: 500 },
    );
  }
}
