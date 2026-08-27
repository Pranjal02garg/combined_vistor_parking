import { NextRequest } from "next/server";

import {
  AUTH_RATE_LIMIT_WINDOW_MS,
  MOBILE_LOGIN_RATE_LIMIT_MAX,
} from "@/lib/auth/constants";
import { verifyAgainstDummyHash, verifyPassword } from "@/lib/auth/crypto";
import { assertHttpsForMobile } from "@/lib/auth/mobile-auth";
import { toMobileSession, toMobileUser } from "@/lib/auth/mobile-response";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";
import {
  clearFailedLoginState,
  createSession,
  findUserByEmail,
  getSecondsUntilUnlocked,
  isUserLocked,
  recordFailedLoginAttempt,
} from "@/lib/auth/service";
import { mobileLoginPayloadSchema } from "@/lib/auth/validators";
import { jsonMobileError, jsonNoStore } from "@/lib/http/response";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertHttpsForMobile(request);

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

    const payload = mobileLoginPayloadSchema.safeParse(requestBody);
    if (!payload.success) {
      return jsonMobileError(
        400,
        "INVALID_PAYLOAD",
        payload.error.issues[0]?.message ?? "Invalid request payload.",
      );
    }

    const { email, password } = payload.data;
    const clientIp = getClientIp(request) ?? "unknown";

    const rateLimitResult = consumeRateLimit({
      key: `mobile:login:${clientIp}:${email}`,
      maxRequests: MOBILE_LOGIN_RATE_LIMIT_MAX,
      windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimitResult.allowed) {
      return jsonMobileError(
        429,
        "RATE_LIMITED",
        "Too many login attempts. Try again shortly.",
        rateLimitResult.retryAfterSeconds,
      );
    }

    const user = await findUserByEmail(email);

    if (!user) {
      await verifyAgainstDummyHash(password);
      await sleep(300);

      return jsonMobileError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password.",
      );
    }

    if (isUserLocked(user)) {
      const retryAfterSeconds = getSecondsUntilUnlocked(user);
      return jsonMobileError(
        423,
        "ACCOUNT_LOCKED",
        "Too many failed attempts. Try again later.",
        retryAfterSeconds,
      );
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      await recordFailedLoginAttempt(user);
      await sleep(300);

      return jsonMobileError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password.",
      );
    }

    await clearFailedLoginState(user._id);

    if (!user.isActive) {
      return jsonMobileError(
        403,
        "FORBIDDEN",
        "Unauthorized access. Contact Abhinav Sharma (Head Admin). Platform Developers: Bhumit Gupta(bgupta1_be23@thapar.edu), Siddharth Sharma (ssharma16_be23@thapar.edu)",
      );
    }

    const { token, expiresAt } = await createSession(user._id, {
      ipAddress: clientIp,
      userAgent: getUserAgent(request),
    });

    return jsonNoStore({
      token,
      user: toMobileUser(user),
      session: toMobileSession(expiresAt),
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
      "Unable to process login.",
    );
  }
}
