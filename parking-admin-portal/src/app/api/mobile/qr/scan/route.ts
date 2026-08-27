import { NextRequest } from "next/server";
import { z } from "zod";

import {
  assertHttpsForMobile,
  getMobileAuthContext,
} from "@/lib/auth/mobile-auth";
import {
  markQrSessionScanned,
  resolveQrSessionId,
} from "@/lib/auth/qr-session";
import { jsonMobileError, jsonNoStore } from "@/lib/http/response";

const scanPayloadSchema = z
  .object({
    qrPayload: z.string().trim().min(1).max(512).optional(),
    sessionId: z.string().trim().min(1).max(64).optional(),
  })
  .refine((value) => Boolean(value.qrPayload || value.sessionId), {
    message: "qrPayload or sessionId is required.",
  });

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
      return jsonMobileError(400, "INVALID_PAYLOAD", "Invalid request payload.");
    }

    const payload = scanPayloadSchema.safeParse(requestBody);
    if (!payload.success) {
      return jsonMobileError(
        400,
        "INVALID_PAYLOAD",
        payload.error.issues[0]?.message ?? "Invalid request payload.",
      );
    }

    const resolvedSessionId = resolveQrSessionId(
      payload.data.qrPayload,
      payload.data.sessionId,
    );

    if (!resolvedSessionId) {
      return jsonMobileError(400, "INVALID_PAYLOAD", "Invalid QR payload.");
    }

    const scanResult = await markQrSessionScanned(resolvedSessionId, auth.user);

    if (!scanResult.ok) {
      if (scanResult.reason === "EXPIRED") {
        return jsonNoStore(
          {
            error: "QR_EXPIRED",
            message: "QR session has expired.",
          },
          { status: 410 },
        );
      }

      if (scanResult.reason === "ALREADY_SCANNED") {
        return jsonNoStore(
          {
            error: "QR_ALREADY_SCANNED",
            message: "QR session was already scanned.",
          },
          { status: 409 },
        );
      }

      return jsonMobileError(400, "INVALID_PAYLOAD", "Invalid QR payload.");
    }

    return jsonNoStore({
      success: true,
      session: scanResult.session,
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

    return jsonMobileError(500, "SERVER_ERROR", "Unable to process QR scan.");
  }
}
