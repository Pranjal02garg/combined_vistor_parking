import { NextRequest } from "next/server";

import {
  assertHttpsForMobile,
  getMobileAuthContext,
} from "@/lib/auth/mobile-auth";
import { invalidateSession } from "@/lib/auth/service";
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

    await invalidateSession(auth.rawToken);

    return jsonNoStore({ message: "Logged out successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    if (message === "HTTPS_REQUIRED") {
      return jsonMobileError(
        403,
        "HTTPS_REQUIRED",
        "HTTPS is required for mobile authentication routes.",
      );
    }

    return jsonMobileError(500, "SERVER_ERROR", "Unable to log out.");
  }
}
