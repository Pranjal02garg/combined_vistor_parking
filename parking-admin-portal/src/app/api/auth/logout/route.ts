import { NextRequest } from "next/server";

import {
  AUTH_RATE_LIMIT_WINDOW_MS,
  LOGOUT_RATE_LIMIT_MAX,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/constants";
import { assertValidCsrfToken } from "@/lib/auth/csrf";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { assertSameOrigin, getClientIp } from "@/lib/auth/request";
import { clearSessionCookie, invalidateSession } from "@/lib/auth/service";
import { jsonNoStore } from "@/lib/http/response";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request);
    await assertValidCsrfToken(request);

    const clientIp = getClientIp(request) ?? "unknown";
    const rateLimitResult = consumeRateLimit({
      key: `logout:${clientIp}`,
      maxRequests: LOGOUT_RATE_LIMIT_MAX,
      windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimitResult.allowed) {
      return jsonNoStore(
        {
          error: "Too many logout requests. Please wait and retry.",
          retryAfter: rateLimitResult.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfterSeconds),
          },
        },
      );
    }

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    await invalidateSession(token);
    await clearSessionCookie();

    return jsonNoStore({ message: "Logged out successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    if (
      message === "Missing Origin header" ||
      message === "Invalid Origin header" ||
      message === "Cross-origin request blocked" ||
      message === "Cross-site fetch blocked"
    ) {
      return jsonNoStore({ error: "Invalid request origin." }, { status: 403 });
    }

    if (message === "Invalid CSRF token") {
      return jsonNoStore({ error: "Invalid CSRF token." }, { status: 403 });
    }

    return jsonNoStore({ error: "Unable to log out." }, { status: 500 });
  }
}
