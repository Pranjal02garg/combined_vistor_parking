import { NextResponse } from "next/server";
import { z } from "zod";

// Uniform JSON helpers. Error bodies are deliberately generic — no stack traces,
// no PII, no internal ids — to avoid leaking anything useful to an attacker.

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, error: string, extra?: unknown) {
  return NextResponse.json({ error, ...(extra ? { details: extra } : {}) }, { status });
}

// Zod parse → typed data or a 400 response. Field paths are returned so the
// client can surface them; values are never echoed back.
export function parseOr400<T>(
  schema: z.ZodType<T>,
  input: unknown
): { ok: true; data: T } | { ok: false; res: NextResponse } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const fields = result.error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  return { ok: false, res: fail(400, "Validation failed", fields) };
}

// Best-effort client IP for rate-limit keys (behind Vercel/proxies).
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Reject state-changing requests whose Origin isn't our own site (CSRF defence
// layered on top of SameSite cookies). Same-origin fetches send a matching Origin.
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser / same-origin navigations omit Origin
  const host = req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
