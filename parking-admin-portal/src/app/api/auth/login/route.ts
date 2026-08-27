import { NextRequest } from "next/server";

import {
  AUTH_RATE_LIMIT_WINDOW_MS,
  LOGIN_RATE_LIMIT_MAX,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/constants";
import { assertValidCsrfToken } from "@/lib/auth/csrf";
import { verifyAgainstDummyHash, verifyPassword } from "@/lib/auth/crypto";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import {
  assertSameOrigin,
  getClientIp,
  getUserAgent,
} from "@/lib/auth/request";
import {
  clearFailedLoginState,
  createSession,
  findUserByEmail,
  invalidateSession,
  isUserLocked,
  recordFailedLoginAttempt,
  setSessionCookie,
  getSecondsUntilUnlocked,
} from "@/lib/auth/service";
import { loginPayloadSchema } from "@/lib/auth/validators";
import { jsonNoStore } from "@/lib/http/response";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request);
    await assertValidCsrfToken(request);

    const payload = loginPayloadSchema.safeParse(await request.json());
    if (!payload.success) {
      return jsonNoStore(
        { error: payload.error.issues[0]?.message ?? "Invalid payload." },
        { status: 400 },
      );
    }

    const { email, password } = payload.data;
    const clientIp = getClientIp(request) ?? "unknown";
    const rateLimitResult = consumeRateLimit({
      key: `login:${clientIp}:${email}`,
      maxRequests: LOGIN_RATE_LIMIT_MAX,
      windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimitResult.allowed) {
      return jsonNoStore(
        {
          error: "Too many login attempts. Try again shortly.",
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

    const user = await findUserByEmail(email);

    if (!user) {
      await verifyAgainstDummyHash(password);
      await sleep(300);

      return jsonNoStore(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    if (isUserLocked(user)) {
      const retryAfter = getSecondsUntilUnlocked(user);
      return jsonNoStore(
        {
          error: "Too many failed attempts. Try again later.",
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
          },
        },
      );
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      await recordFailedLoginAttempt(user);
      await sleep(300);

      return jsonNoStore(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    await clearFailedLoginState(user._id);

    if (!user.isActive) {
      return jsonNoStore(
        { error: "Unauthorized access. Contact Abhinav Sharma (Head Admin). Platform Developers: Bhumit Gupta(bgupta1_be23@thapar.edu), Siddharth Sharma (ssharma16_be23@thapar.edu)" },
        { status: 403 }
      );
    }

    const currentToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    await invalidateSession(currentToken);

    const { token, expiresAt } = await createSession(user._id, {
      ipAddress: clientIp,
      userAgent: getUserAgent(request),
    });

    await setSessionCookie(token, expiresAt);

    return jsonNoStore({
      message: "Login successful.",
      user: {
        id: user._id.toHexString(),
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      session: {
        expiresAt: expiresAt.toISOString(),
      },
    });
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

    if (
      message.includes("MongoServerSelectionError") ||
      message.includes("querySrv") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND")
    ) {
      return jsonNoStore(
        {
          error:
            "Database connection failed. Verify MONGODB_URI and network access to MongoDB.",
        },
        { status: 503 },
      );
    }

    return jsonNoStore({ error: "Unable to process login." }, { status: 500 });
  }
}
