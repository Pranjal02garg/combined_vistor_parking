import type { VIPPassStatus } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { vipDecisionSchema } from "@/lib/validation/vip";
import { sendPushToUser } from "@/lib/server/push";

// PATCH /api/vip/:id/decision — HEAD. Approve / reject a pending VIP pass.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD") return fail(403, "HEAD only");
  if (!(await allow(guardLimiter, user.userId))) return fail(429, "Too many requests");

  const { id } = await params;
  if (!id || id.length > 64) return fail(400, "Bad id");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }
  const parsed = parseOr400(vipDecisionSchema, body);
  if (!parsed.ok) return parsed.res;

  const nextStatus: VIPPassStatus =
    parsed.data.action === "approve" ? "APPROVED" : "REJECTED";

  // Atomic guarded update — only a PENDING pass can be decided.
  const result = await prisma.vIPPass.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: nextStatus,
      approvedById: user.userId,
      approvedAt: new Date(),
    },
  });
  if (result.count === 0) return fail(409, "Pass not found or already decided");

  // Tell the hosting faculty their guest pass was approved.
  if (nextStatus === "APPROVED") {
    const pass = await prisma.vIPPass.findUnique({
      where: { id },
      select: { hostStaffId: true, guestName: true, token: true },
    });
    if (pass?.hostStaffId) {
      void sendPushToUser(pass.hostStaffId, {
        title: "Guest pass approved",
        body: `${pass.guestName}'s gate pass has been approved.`,
        data: { type: "VIP_APPROVED", token: pass.token },
      });
    }
  }

  return ok({ id, status: nextStatus });
}
