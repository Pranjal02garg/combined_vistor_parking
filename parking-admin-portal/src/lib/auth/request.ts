import { NextRequest } from "next/server";

import { getAppOrigin } from "@/lib/env";

export function assertSameOrigin(request: NextRequest): void {
  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    throw new Error("Missing Origin header");
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(originHeader);
  } catch {
    throw new Error("Invalid Origin header");
  }

  const allowedOrigin = getAppOrigin() ?? request.nextUrl.origin;
  const allowed = new URL(allowedOrigin);

  if (parsedOrigin.origin !== allowed.origin) {
    throw new Error("Cross-origin request blocked");
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (
    fetchSite &&
    fetchSite !== "same-origin" &&
    fetchSite !== "same-site" &&
    fetchSite !== "none"
  ) {
    throw new Error("Cross-site fetch blocked");
  }
}

export function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.headers.get("x-real-ip");
}

export function getUserAgent(request: NextRequest): string | null {
  return request.headers.get("user-agent");
}
