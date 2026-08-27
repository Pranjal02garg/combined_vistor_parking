import { prisma } from "@/lib/server/prisma";
import { getGuard, canAccessGate } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail, parseOr400 } from "@/lib/server/http";
import { queueQuerySchema } from "@/lib/validation/visit";
import { toVisitDTO, visitInclude } from "@/lib/server/dto";

const PAGE_SIZE = 50;

// GET /api/visits/queue?gateId=&cursor= — GUARD.
// IDOR-scoped: a guard sees only the pending/escalated queue for a gate they are
// assigned to (privileged roles may view any gate).
export async function GET(req: Request) {
  const guard = await getGuard();
  if (!guard) return fail(401, "Not signed in");

  if (!(await allow(guardLimiter, guard.userId))) {
    return fail(429, "Too many requests");
  }

  const { searchParams } = new URL(req.url);
  const parsed = parseOr400(queueQuerySchema, {
    gateId: searchParams.get("gateId") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.ok) return parsed.res;
  const { gateId, cursor } = parsed.data;

  if (!canAccessGate(guard, gateId)) return fail(403, "Gate not permitted");

  const rows = await prisma.visitLog.findMany({
    where: { entryGateId: gateId, status: { in: ["PENDING", "ESCALATED"] } },
    include: visitInclude,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasMore = rows.length > PAGE_SIZE;
  const rawItems = rows.slice(0, PAGE_SIZE).map(toVisitDTO);
  const nextCursor = hasMore ? rawItems[rawItems.length - 1].id : null;

  const phones = rawItems.map((i) => i.phone);
  const { getActiveBlacklistPhones } = await import("@/lib/server/blacklist");
  const blacklistedSet = await getActiveBlacklistPhones(phones);
  
  const items = rawItems.map((i) => ({
    ...i,
    blacklisted: blacklistedSet.has(i.phone),
  }));

  return ok({ items, nextCursor });
}
