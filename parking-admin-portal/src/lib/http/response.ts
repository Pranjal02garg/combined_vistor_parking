import type { MobileErrorBody, MobileErrorCode } from "@/lib/auth/types";

export function jsonNoStore(
  payload: unknown,
  init?: ResponseInit,
): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");

  return Response.json(payload, {
    ...init,
    headers,
  });
}

export function jsonMobileError(
  status: 400 | 401 | 403 | 423 | 429 | 500,
  error: MobileErrorCode,
  message: string,
  retryAfterSeconds?: number,
): Response {
  const payload: MobileErrorBody = {
    error,
    message,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };

  const headers =
    retryAfterSeconds !== undefined
      ? { "Retry-After": String(retryAfterSeconds) }
      : undefined;

  return jsonNoStore(payload, { status, headers });
}
