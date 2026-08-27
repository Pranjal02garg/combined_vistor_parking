import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { vipGateActionSchema } from "@/lib/validation/vip";

// POST /api/vip/exit — GUARD/HEAD. Sign a checked-in VIP out (cross-gate allowed).
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "GUARD" && user.role !== "HEAD") return fail(403, "Not permitted");
  if (!(await allow(guardLimiter, user.userId))) return fail(429, "Too many requests");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }
  const parsed = parseOr400(vipGateActionSchema, body);
  if (!parsed.ok) return parsed.res;
  const { token, gateId } = parsed.data;

  const gate = await prisma.gate.findFirst({
    where: { id: gateId, isActive: true },
    select: { id: true },
  });
  if (!gate) return fail(400, "Unknown gate");

  const pass = await prisma.vIPPass.findUnique({
    where: { token },
    select: { status: true },
  });
  if (!pass) return fail(404, "Invalid pass");
  if (pass.status !== "CHECKED_IN") return fail(409, "VIP is not currently inside");

  const result = await prisma.vIPPass.updateMany({
    where: { token, status: "CHECKED_IN" },
    data: { status: "EXITED", exitGateId: gateId, exitedAt: new Date() },
  });
  if (result.count === 0) return fail(409, "VIP is not currently inside");

  return ok({ token, status: "EXITED" });
}
