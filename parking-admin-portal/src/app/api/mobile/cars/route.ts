import { NextRequest } from "next/server";
import { z } from "zod";

import {
    assertHttpsForMobile,
    getMobileAuthContext,
} from "@/lib/auth/mobile-auth";
import type { AllowedCar, UserDocument } from "@/lib/auth/types";
import { jsonMobileError, jsonNoStore } from "@/lib/http/response";
import { getDb } from "@/lib/mongodb";

const platePattern = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;

const plateSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(platePattern, "Use plate format like PB10AB1234.");

const addCarPayloadSchema = z.object({
  plateNumber: plateSchema,
  stickerColor: z.enum(["green", "red", "blue"]).default("green"),
});

const deleteCarPayloadSchema = z.object({
  plateNumber: plateSchema,
});

async function getCarsForUser(
  userId: UserDocument["_id"],
): Promise<AllowedCar[]> {
  const db = await getDb();
  const user = await db
    .collection<UserDocument>("users")
    .findOne({ _id: userId }, { projection: { allowedCars: 1 } });

  return user?.allowedCars ?? [];
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    assertHttpsForMobile(request);

    const auth = await getMobileAuthContext(request);
    if (!auth) {
      return jsonMobileError(401, "INVALID_TOKEN", "Invalid or expired token.");
    }

    const cars = await getCarsForUser(auth.user._id);

    return jsonNoStore({ cars });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    if (message === "HTTPS_REQUIRED") {
      return jsonMobileError(
        403,
        "HTTPS_REQUIRED",
        "HTTPS is required for mobile authentication routes.",
      );
    }

    return jsonMobileError(500, "SERVER_ERROR", "Unable to load cars.");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertHttpsForMobile(request);

    const auth = await getMobileAuthContext(request);
    if (!auth) {
      return jsonMobileError(401, "INVALID_TOKEN", "Invalid or expired token.");
    }

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return jsonMobileError(
        400,
        "INVALID_PAYLOAD",
        "Invalid request payload.",
      );
    }

    const payload = addCarPayloadSchema.safeParse(requestBody);
    if (!payload.success) {
      return jsonMobileError(
        400,
        "INVALID_PAYLOAD",
        payload.error.issues[0]?.message ?? "Invalid request payload.",
      );
    }

    const nextCar: AllowedCar = {
      plateNumber: payload.data.plateNumber,
      stickerColor: payload.data.stickerColor,
    };

    const existingCars = await getCarsForUser(auth.user._id);
    if (existingCars.some((car) => car.plateNumber === nextCar.plateNumber)) {
      return jsonMobileError(
        400,
        "INVALID_PAYLOAD",
        "This plate number is already registered.",
      );
    }

    const db = await getDb();
    await db.collection<UserDocument>("users").updateOne(
      { _id: auth.user._id },
      {
        $push: { allowedCars: nextCar },
        $set: { updatedAt: new Date() },
      },
    );

    const changeDoc = {
      "car number": nextCar.plateNumber,
      action: "add",
      userId: auth.user._id,
      userEmail: auth.user.email,
      timestamp: new Date(),
    };
    
    await db.collection("car_changes").insertOne({ ...changeDoc });
    await db.collection("system_logs").insertOne({ ...changeDoc });

    return jsonNoStore({ car: nextCar }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    if (message === "HTTPS_REQUIRED") {
      return jsonMobileError(
        403,
        "HTTPS_REQUIRED",
        "HTTPS is required for mobile authentication routes.",
      );
    }

    return jsonMobileError(500, "SERVER_ERROR", "Unable to add car.");
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    assertHttpsForMobile(request);

    const auth = await getMobileAuthContext(request);
    if (!auth) {
      return jsonMobileError(401, "INVALID_TOKEN", "Invalid or expired token.");
    }

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      return jsonMobileError(
        400,
        "INVALID_PAYLOAD",
        "Invalid request payload.",
      );
    }

    const payload = deleteCarPayloadSchema.safeParse(requestBody);
    if (!payload.success) {
      return jsonMobileError(
        400,
        "INVALID_PAYLOAD",
        payload.error.issues[0]?.message ?? "Invalid request payload.",
      );
    }

    const db = await getDb();
    const result = await db.collection<UserDocument>("users").updateOne(
      {
        _id: auth.user._id,
        "allowedCars.plateNumber": payload.data.plateNumber,
      },
      {
        $pull: {
          allowedCars: {
            plateNumber: payload.data.plateNumber,
          },
        },
        $set: {
          updatedAt: new Date(),
        },
      },
    );

    if (result.modifiedCount === 0) {
      return jsonNoStore(
        {
          error: "NOT_FOUND",
          message: "Car not found.",
        },
        { status: 404 },
      );
    }

    const changeDoc = {
      "car number": payload.data.plateNumber,
      action: "delete",
      userId: auth.user._id,
      userEmail: auth.user.email,
      timestamp: new Date(),
    };

    await db.collection("car_changes").insertOne({ ...changeDoc });
    await db.collection("system_logs").insertOne({ ...changeDoc });

    return jsonNoStore({ message: "Car removed successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    if (message === "HTTPS_REQUIRED") {
      return jsonMobileError(
        403,
        "HTTPS_REQUIRED",
        "HTTPS is required for mobile authentication routes.",
      );
    }

    return jsonMobileError(500, "SERVER_ERROR", "Unable to remove car.");
  }
}
