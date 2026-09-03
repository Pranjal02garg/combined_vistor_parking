import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { vipGateActionSchema } from "@/lib/validation/vip";
import { getSettings } from "@/lib/server/settings";

// POST /api/vip/checkin — GUARD/HEAD. Step two of the two-step flow: activate an
// already HEAD-APPROVED pass at the gate. VIP entry is campus-wide (any gate).
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
    select: { status: true, validUntil: true, guestPhone: true, vehicleNumber: true },
  });
  if (!pass) return fail(404, "Invalid pass");
  if (pass.status !== "APPROVED") return fail(409, "Pass is not approved for entry");
  if (pass.validUntil && pass.validUntil.getTime() < Date.now()) {
    return fail(409, "Pass has expired");
  }

  const settings = await getSettings();
  if ((settings.featureFlags as any)?.lockdownActive) {
    return fail(403, "Lockdown is active. No new entries permitted.");
  }

  // Prevent the SAME guest/vehicle from being inside on two VIP passes at once.
  // (Previously this cross-checked the separate regular-visit table by phone/
  //  plate, which falsely blocked a valid guest pass whenever the number
  //  coincidentally matched an unrelated walk-in visit. The two systems are
  //  independent; a VIP pass has its own state machine.) Blank phone/plate is
  //  never treated as a match.
  if (pass.guestPhone && pass.guestPhone.trim()) {
    const dupPhone = await prisma.vIPPass.findFirst({
      where: { guestPhone: pass.guestPhone, status: "CHECKED_IN", NOT: { token } },
      select: { id: true },
    });
    if (dupPhone) {
      return fail(409, "This guest is already inside on another pass.");
    }
  }

  if (pass.vehicleNumber && pass.vehicleNumber.trim()) {
    const dupVehicle = await prisma.vIPPass.findFirst({
      where: { vehicleNumber: pass.vehicleNumber, status: "CHECKED_IN", NOT: { token } },
      select: { id: true },
    });
    if (dupVehicle) {
      return fail(409, "This vehicle is already inside on another pass.");
    }
  }

  const result = await prisma.vIPPass.updateMany({
    where: { token, status: "APPROVED" },
    data: {
      status: "CHECKED_IN",
      entryGateId: gateId,
      scannedById: user.userId,
      onDutyGuard: parsed.data.onDutyGuard,
      enteredAt: new Date(),
    },
  });
  if (result.count === 0) return fail(409, "Pass is not approved for entry");

  return ok({ token, status: "CHECKED_IN" });
}
