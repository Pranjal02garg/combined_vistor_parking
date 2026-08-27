import { randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/auth/constants";

function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 60 * 60 * 24,
  };
}

function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function issueCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (existingToken) {
    return existingToken;
  }

  const token = generateCsrfToken();
  cookieStore.set(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());

  return token;
}

export async function assertValidCsrfToken(request: NextRequest): Promise<void> {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    throw new Error("Invalid CSRF token");
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  if (
    cookieBuffer.length !== headerBuffer.length ||
    !timingSafeEqual(cookieBuffer, headerBuffer)
  ) {
    throw new Error("Invalid CSRF token");
  }
}
