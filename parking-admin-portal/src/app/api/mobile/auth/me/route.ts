import { NextRequest } from "next/server";

import {
  assertHttpsForMobile,
  getMobileAuthContext,
} from "@/lib/auth/mobile-auth";
import { toMobileSession, toMobileUser } from "@/lib/auth/mobile-response";
import { jsonMobileError, jsonNoStore } from "@/lib/http/response";

export async function GET(request: NextRequest): Promise<Response> {
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

    return jsonNoStore({
      user: toMobileUser(auth.user),
      session: toMobileSession(auth.session.expiresAt),
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
      "Unable to read mobile session.",
    );
  }
}
