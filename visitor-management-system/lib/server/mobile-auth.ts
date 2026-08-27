import { prisma } from "@/lib/server/prisma";
import crypto from "crypto";

const MOBILE_SECRET = process.env.AUTH_SECRET || "dev-secret-campus-vms-mobile-auth-2026";

export function createMobileToken(userId: string): string {
  const payload = {
    userId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  const str = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", MOBILE_SECRET).update(str).digest("hex");
  return Buffer.from(`${str}.${hmac}`).toString("base64url");
}

export async function verifyMobileToken(token: string) {
  try {
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
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return verifyMobileToken(token);
}
