import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail } from "@/lib/server/http";
import { toVIPDTO, vipInclude } from "@/lib/server/vip";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/vip/queue — HEAD. Pending VIP passes awaiting approval (HEAD's feed).
export async function GET() {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD") return fail(403, "HEAD only");
  if (!(await allow(guardLimiter, user.userId))) return fail(429, "Too many requests");

  const rows = await prisma.vIPPass.findMany({
    where: { status: "PENDING" },
    include: vipInclude,
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const rawItems = rows.map(toVIPDTO);
  const phones = rawItems.map((i) => i.guestPhone);
  const { getActiveBlacklistPhones } = await import("@/lib/server/blacklist");
  const blacklistedSet = await getActiveBlacklistPhones(phones);

  const items = rawItems.map((i) => ({
    ...i,
    blacklisted: blacklistedSet.has(i.guestPhone),
  }));

  return ok({ items });
}
