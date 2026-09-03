import { prisma } from "@/lib/server/prisma";
import crypto from "crypto";
import { getGuard } from "./session";

// SEC-2: never fall back to a hardcoded secret. A missing AUTH_SECRET must fail
// loudly rather than silently sign tokens with a key that lives in the repo.
const MOBILE_SECRET = process.env.AUTH_SECRET;

function requireSecret(): string {
  if (!MOBILE_SECRET) {
    throw new Error("AUTH_SECRET is not set — refusing to sign/verify mobile tokens.");
  }
  return MOBILE_SECRET;
}

export function createMobileToken(userId: string): string {
  const secret = requireSecret();
  const payload = {
    userId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  const str = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret).update(str).digest("hex");
  return Buffer.from(`${str}.${hmac}`).toString("base64url");
}

export async function verifyMobileToken(token: string) {
  try {
    if (!MOBILE_SECRET) return null; // SEC-2: no secret ⇒ verify nothing.
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [str, hmac] = raw.split(".");
    if (!str || !hmac) return null;

    const expectedHmac = crypto.createHmac("sha256", MOBILE_SECRET).update(str).digest("hex");
    if (hmac !== expectedHmac) return null;

    const payload = JSON.parse(str);
    if (payload.expiresAt < Date.now()) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        vehicles: { where: { isActive: true } },
      },
    });

    if (!user || !user.isActive) return null;
    return user;
  } catch {
    return null;
  }
}

export async function getMobileUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const u = await verifyMobileToken(token);
    if (u) return u;
  }

  // Legitimate web-session fallback: a signed-in cookie session (e.g. the RN-web
  // build) is still real authentication.
  const guardSession = await getGuard().catch(() => null);
  if (guardSession?.userId) {
    const u = await prisma.user.findUnique({
      where: { id: guardSession.userId },
      include: { vehicles: { where: { isActive: true } } },
    });
    if (u && u.isActive) return u;
  }

  // SEC-1: no valid token and no session ⇒ NOT authenticated. Never impersonate
  // a default staff user. Callers must treat null as 401.
  return null;
}
