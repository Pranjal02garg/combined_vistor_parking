import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail } from "@/lib/server/http";
import { toVIPDTO, vipInclude } from "@/lib/server/vip";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/vip/expected — GUARD/HEAD. The incoming VIP directory: every pass that
// is awaiting approval (PENDING) or approved-and-not-yet-entered (APPROVED). This
// gives guards visibility of staff-generated requests the moment they're created;
// the client shows a status badge and only enables Check-In for APPROVED passes.
export async function GET() {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "GUARD" && user.role !== "HEAD") {
    return fail(403, "Forbidden");
  }
  if (!(await allow(guardLimiter, user.userId))) {
    return fail(429, "Too many requests");
  }

  const rows = await prisma.vIPPass.findMany({
    where: {
      status: { in: ["PENDING", "APPROVED"] },
      enteredAt: null,
    },
    include: vipInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return ok({ items: rows.map(toVIPDTO) });
}
