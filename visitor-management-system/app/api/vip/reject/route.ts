import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { vipGateActionSchema } from "@/lib/validation/vip";

// POST /api/vip/reject — GUARD/HEAD. Deny a guest pass at the gate (turn the
// visitor away). Only a pass that has not yet entered/exited can be rejected.
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
  const { token } = parsed.data;

  const pass = await prisma.vIPPass.findUnique({
    where: { token },
    select: { status: true },
  });
  if (!pass) return fail(404, "Invalid pass");

  // Atomic guarded update — only a not-yet-entered pass can be rejected.
  const result = await prisma.vIPPass.updateMany({
    where: { token, status: { in: ["PENDING", "APPROVED"] } },
    data: {
      status: "REJECTED",
      scannedById: user.userId,
      onDutyGuard: parsed.data.onDutyGuard,
    },
  });
  if (result.count === 0) {
    return fail(409, "Pass can't be rejected (already entered, exited, or decided).");
  }

  return ok({ token, status: "REJECTED" });
}
