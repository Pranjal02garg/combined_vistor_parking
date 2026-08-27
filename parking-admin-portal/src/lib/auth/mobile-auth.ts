import { NextRequest } from "next/server";

import type { SessionDocument, UserDocument } from "@/lib/auth/types";
import { getSessionWithUserFromToken } from "@/lib/auth/service";

export type MobileAuthContext = {
  user: UserDocument;
  session: SessionDocument;
  rawToken: string;
  sessionId: string;
};

export function assertHttpsForMobile(request: NextRequest): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  if (forwardedProto === "https") {
    return;
  }

  if (request.nextUrl.protocol === "https:") {
    return;
  }

  throw new Error("HTTPS_REQUIRED");
}

export function extractBearerToken(request: NextRequest): string | null {
  const authorizationHeader = request.headers.get("authorization");
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);
  if (rest.length > 0) {
    return null;
  }

  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

export async function getMobileAuthContext(
  request: NextRequest,
): Promise<MobileAuthContext | null> {
  const rawToken = extractBearerToken(request);
  if (!rawToken) {
    return null;
  }

  const auth = await getSessionWithUserFromToken(rawToken);
  if (!auth) {
    return null;
  }

  return {
    user: auth.user,
    session: auth.session,
    rawToken,
    sessionId: auth.session._id.toHexString(),
  };
}
