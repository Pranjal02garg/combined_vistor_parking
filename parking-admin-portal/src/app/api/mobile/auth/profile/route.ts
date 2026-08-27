import { NextRequest } from "next/server";

import {
  AUTH_RATE_LIMIT_WINDOW_MS,
  MOBILE_PROFILE_RATE_LIMIT_MAX,
} from "@/lib/auth/constants";
import {
  assertHttpsForMobile,
  getMobileAuthContext,
} from "@/lib/auth/mobile-auth";
import { toMobileUser } from "@/lib/auth/mobile-response";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { getClientIp } from "@/lib/auth/request";
import { updateUserProfile } from "@/lib/auth/service";
import { mobileProfilePatchPayloadSchema } from "@/lib/auth/validators";
import { jsonMobileError, jsonNoStore } from "@/lib/http/response";

export async function PATCH(request: NextRequest): Promise<Response> {
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
      key: `mobile:profile:${clientIp}:${auth.user._id.toHexString()}`,
      maxRequests: MOBILE_PROFILE_RATE_LIMIT_MAX,
      windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimitResult.allowed) {
      return jsonMobileError(
        429,
        "RATE_LIMITED",
        "Too many profile update requests. Try again shortly.",
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

    const payload = mobileProfilePatchPayloadSchema.safeParse(requestBody);
    if (!payload.success) {
      return jsonMobileError(
        400,
        "INVALID_PAYLOAD",
        payload.error.issues[0]?.message ?? "Invalid request payload.",
      );
    }

    const updatedUser = await updateUserProfile(auth.user._id, {
      name: payload.data.name,
      department: payload.data.department,
      phone: payload.data.phone,
      alternateContact: payload.data.alternateContact,
    });

    if (!updatedUser) {
      return jsonMobileError(401, "INVALID_TOKEN", "Invalid or expired token.");
    }

    return jsonNoStore({
      user: toMobileUser(updatedUser),
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

    return jsonMobileError(
      500,
      "SERVER_ERROR",
      "Unable to update profile.",
    );
  }
}
