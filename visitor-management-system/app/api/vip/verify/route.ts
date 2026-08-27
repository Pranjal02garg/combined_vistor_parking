import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail, parseOr400 } from "@/lib/server/http";
import { vipVerifyQuerySchema } from "@/lib/validation/vip";
import { effectiveStatus } from "@/lib/server/vip";

// GET /api/vip/verify?token= — GUARD or HEAD. The guard-scan lookup: returns the
// current status, guest/host details, and WHO approved it. STAFF cannot verify.
export async function GET(req: Request) {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "GUARD" && user.role !== "HEAD") return fail(403, "Not permitted");
  if (!(await allow(guardLimiter, user.userId))) return fail(429, "Too many requests");

  const { searchParams } = new URL(req.url);
  const parsed = parseOr400(vipVerifyQuerySchema, {
    token: searchParams.get("token") ?? undefined,
  });
  if (!parsed.ok) return parsed.res;

  const pass = await prisma.vIPPass.findUnique({
    where: { token: parsed.data.token },
    include: {
      hostStaff: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
  });
  if (!pass) return fail(404, "Invalid pass");

  return ok({
    status: effectiveStatus(pass),
    guestName: pass.guestName,
    guestPhone: pass.guestPhone,
    purpose: pass.purpose,
    vehicleNumber: pass.vehicleNumber,
    hostStaff: pass.hostStaff.name,
    approver:
      pass.approvedBy && pass.approvedAt
        ? { name: pass.approvedBy.name, approvedAt: pass.approvedAt.toISOString() }
        : null,
    validFrom: pass.validFrom?.toISOString() ?? null,
    validUntil: pass.validUntil?.toISOString() ?? null,
    alreadyEntered: pass.status === "CHECKED_IN" || pass.status === "EXITED",
  });
}
