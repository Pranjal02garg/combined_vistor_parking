import { NextRequest } from "next/server";

import {
  AUTH_RATE_LIMIT_WINDOW_MS,
  MOBILE_PASSWORD_CHANGE_RATE_LIMIT_MAX,
} from "@/lib/auth/constants";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import {
  assertHttpsForMobile,
  getMobileAuthContext,
} from "@/lib/auth/mobile-auth";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { getClientIp } from "@/lib/auth/request";
import {
  invalidateOtherSessions,
  updateUserPassword,
} from "@/lib/auth/service";
import { mobileChangePasswordPayloadSchema } from "@/lib/auth/validators";
import { jsonMobileError, jsonNoStore } from "@/lib/http/response";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertHttpsForMobile(request);

    const auth = await getMobileAuthContext(request);
    if (!auth) {
      return jsonMobileError(
        401,
        "INVALID_TOKEN",
        "Invalid or expired token.",
      );
    }

    const clientIp = getClientIp(request) ?? "unknown";
    const rateLimitResult = consumeRateLimit({
      key: `mobile:password-change:${clientIp}:${auth.user._id.toHexString()}`,
      maxRequests: MOBILE_PASSWORD_CHANGE_RATE_LIMIT_MAX,
      windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimitResult.allowed) {
      return jsonMobileError(
        429,
        "RATE_LIMITED",
        "Too many password change requests. Try again shortly.",
        rateLimitResult.retryAfterSeconds,
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

    const payload = mobileChangePasswordPayloadSchema.safeParse(requestBody);
    if (!payload.success) {
      return jsonMobileError(
        400,
        "INVALID_PAYLOAD",
        payload.error.issues[0]?.message ?? "Invalid request payload.",
      );
    }

    const passwordValid = await verifyPassword(
      payload.data.currentPassword,
      auth.user.passwordHash,
    );

    if (!passwordValid) {
      return jsonMobileError(
        401,
        "INVALID_CREDENTIALS",
        "Current password is incorrect.",
      );
    }

    const passwordHash = await hashPassword(payload.data.newPassword);
    await updateUserPassword(auth.user._id, passwordHash);
    await invalidateOtherSessions(auth.user._id, auth.session._id);

    return jsonNoStore({ message: "Password updated successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    if (message === "HTTPS_REQUIRED") {
      return jsonMobileError(
        403,
        "HTTPS_REQUIRED",
        "HTTPS is required for mobile authentication routes.",
      );
    }

    return jsonMobileError(
      500,
      "SERVER_ERROR",
      "Unable to change password.",
    );
  }
}
