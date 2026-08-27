import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail, parseOr400 } from "@/lib/server/http";
import { searchQuerySchema } from "@/lib/validation/visit";
import { toVisitDTO, visitInclude } from "@/lib/server/dto";

const LIMIT = 25;

// GET /api/visits/search?q= — GUARD.
// Deliberately CAMPUS-WIDE (not gate-scoped): cross-gate exit means a guard at any
// gate must be able to find an APPROVED visitor to sign them out. Still fully
// authenticated, rate-limited, read-only, and restricted to APPROVED records.
export async function GET(req: Request) {
  const guard = await getGuard();
  if (!guard) return fail(401, "Not signed in");

  if (!(await allow(guardLimiter, guard.userId))) {
    return fail(429, "Too many requests");
  }

  const { searchParams } = new URL(req.url);
  const parsed = parseOr400(searchQuerySchema, {
    q: searchParams.get("q") ?? undefined,
  });
  if (!parsed.ok) return parsed.res;
  const q = parsed.data.q;
  const upper = q.toUpperCase();

  // All `contains` filters are parameterised by Prisma — no SQL injection surface.
  const rows = await prisma.visitLog.findMany({
    where: {
      status: "APPROVED",
      OR: [
        { referenceCode: { contains: upper } },
        { vehicleNumber: { contains: upper } },
        { visitor: { name: { contains: q } } },
        { visitor: { phone: { contains: q } } },
      ],
    },
    include: visitInclude,
    orderBy: { approvedAt: "desc" },
    take: LIMIT,
  });

  return ok({ items: rows.map(toVisitDTO) });
}
