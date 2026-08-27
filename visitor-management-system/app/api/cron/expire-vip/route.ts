import { prisma } from "@/lib/server/prisma";
import { ok, fail } from "@/lib/server/http";

// GET /api/cron/expire-vip
// Meant to be called by a cron job (e.g. Vercel Cron) to expire VIP passes
export async function GET(req: Request) {
  // CRON_SECRET is required in production — fail closed rather than open, so
  // an unset env var can't accidentally leave this endpoint fully public.
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV !== "production";
  if (!secret && !isDev) return fail(500, "CRON_SECRET is not configured");
  if (secret && authHeader !== `Bearer ${secret}`) {
    return fail(401, "Unauthorized");
  }

  const now = new Date();
  
  try {
    const result = await prisma.vIPPass.updateMany({
      where: {
        status: "APPROVED",
        validUntil: { lt: now }
      },
      data: {
        status: "EXPIRED"
      }
    });
    
    return ok({ 
      expiredVIPs: result.count,
      timestamp: now.toISOString()
    });
  } catch (error: any) {
    return fail(500, error.message || "Failed to run expiry cron");
  }
}
