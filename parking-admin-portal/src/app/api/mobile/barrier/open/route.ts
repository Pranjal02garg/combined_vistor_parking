import { NextRequest } from "next/server";
import { z } from "zod";

import {
    assertHttpsForMobile,
    getMobileAuthContext,
} from "@/lib/auth/mobile-auth";
import { jsonMobileError, jsonNoStore } from "@/lib/http/response";

const QR_PREFIX = process.env.MOBILE_QR_PREFIX ?? "PARKING_OPEN:";

const platePattern = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;

const payloadSchema = z
  .object({
    qrPayload: z.string().trim().min(1).max(256).optional(),
    barrierId: z.string().trim().min(1).max(64).optional(),
    plateNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(platePattern, "Use plate format like PB10AB1234.")
      .optional(),
  })
  .refine((value) => Boolean(value.qrPayload || value.barrierId), {
    message: "qrPayload or barrierId is required.",
  });

function deriveBarrierId(
  qrPayload: string | undefined,
  barrierId: string | undefined,
): string | null {
  if (barrierId) {
    return barrierId;
  }

  if (!qrPayload) {
    return null;
  }

  if (!qrPayload.startsWith(QR_PREFIX)) {
    return null;
  }

  const derived = qrPayload.slice(QR_PREFIX.length).trim();
  return derived.length > 0 ? derived : null;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertHttpsForMobile(request);

    const auth = await getMobileAuthContext(request);
    if (!auth) {
      return jsonMobileError(401, "INVALID_TOKEN", "Invalid or expired token.");
    }

    if (!auth.user.parkingEligible) {
      return jsonMobileError(
        403,
        "FORBIDDEN",
        "Your account is not permitted to open barriers.",
      );
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

    const payload = payloadSchema.safeParse(requestBody);
    if (!payload.success) {
      return jsonMobileError(
        400,
        "INVALID_PAYLOAD",
        payload.error.issues[0]?.message ?? "Invalid request payload.",
      );
    }

    const resolvedBarrierId = deriveBarrierId(
      payload.data.qrPayload,
      payload.data.barrierId,
    );

    if (!resolvedBarrierId) {
      return jsonMobileError(
        400,
        "INVALID_PAYLOAD",
        "Invalid barrier payload.",
      );
    }

    if (payload.data.plateNumber) {
      const isAllowedCar = (auth.user.allowedCars ?? []).some(
        (car) => car.plateNumber === payload.data.plateNumber,
      );

      if (!isAllowedCar) {
        return jsonMobileError(
          403,
          "FORBIDDEN",
          "Provided plate number is not linked to your account.",
        );
      }
    }

    return jsonNoStore({
      success: true,
      message: "Barrier access granted.",
      barrierId: resolvedBarrierId,
      grantedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    if (message === "HTTPS_REQUIRED") {
      return jsonMobileError(
        403,
        "HTTPS_REQUIRED",
        "HTTPS is required for mobile authentication routes.",
      );
    }

    return jsonMobileError(500, "SERVER_ERROR", "Unable to open barrier.");
  }
}
