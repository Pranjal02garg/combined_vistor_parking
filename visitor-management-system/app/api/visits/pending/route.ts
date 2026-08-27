import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail } from "@/lib/server/http";
import { toVisitDTO, visitInclude } from "@/lib/server/dto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/visits/pending — GUARD/HEAD. Campus-wide pending/escalated standard
// visits across ALL gates. Any operator can see and act on any pending entry;
// the entry gate (where the visitor registered) travels with each record.
export async function GET() {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "GUARD" && user.role !== "HEAD") return fail(403, "Forbidden");
  if (!(await allow(guardLimiter, user.userId))) return fail(429, "Too many requests");

  const rows = await prisma.visitLog.findMany({
    where: { status: { in: ["PENDING", "ESCALATED"] } },
    include: visitInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return ok({ items: rows.map(toVisitDTO) });
}
