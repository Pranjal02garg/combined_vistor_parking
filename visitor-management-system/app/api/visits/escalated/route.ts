import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail } from "@/lib/server/http";
import { toVisitDTO, visitInclude } from "@/lib/server/dto";

// GET /api/visits/escalated — HEAD. Campus-wide ESCALATED standard logs (alerts feed).
export async function GET() {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD") return fail(403, "HEAD only");
  if (!(await allow(guardLimiter, user.userId))) return fail(429, "Too many requests");

  const rows = await prisma.visitLog.findMany({
    where: { status: "ESCALATED" },
    include: visitInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok({ items: rows.map(toVisitDTO) });
}
