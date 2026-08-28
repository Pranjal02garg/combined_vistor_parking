import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";
import { sendPushToUser } from "@/lib/server/push";
import { getSettings } from "@/lib/server/settings";

// POST /api/guard/house-help/action — GUARD/HEAD. Record check-in / check-out for house help
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "GUARD" && user.role !== "HEAD") return fail(403, "Forbidden");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const token = (body.token || "").trim().toUpperCase();
  const action = body.action; // "CHECK_IN" | "CHECK_OUT"
  const gateId = body.gateId || null;
  const remarks = body.remarks || null;

  if (!token) return fail(400, "Token is required");
  if (action !== "CHECK_IN" && action !== "CHECK_OUT") return fail(400, "Invalid action");

  const help = await prisma.houseHelp.findUnique({
    where: { token },
    include: { staffLinks: { select: { isActive: true, validUntil: true } } },
  });

  if (!help) return fail(404, "House help pass not found");

  // ── Server-side gate enforcement (previously only the lookup checked these,
  //    which meant a direct action call bypassed every revocation) ────────────

  // 1. HEAD clearance must be APPROVED (blocks PENDING_APPROVAL / REJECTED).
  if (help.status !== "APPROVED") {
    return fail(403, `Entry denied — clearance status is ${help.status}.`);
  }

  // 2. At least one resident link must be active AND unexpired (honors the
  //    staff "Pause / Unlink" and validity window that were being ignored).
  const now = new Date();
  const hasValidEmployer = help.staffLinks.some(
    (l) => l.isActive && !!l.validUntil && l.validUntil >= now
  );
  if (!hasValidEmployer) {
    return fail(403, "Entry denied — pass paused, unlinked, or expired by resident.");
  }

  // 3. Lockdown blocks new entries (exits are always allowed so people can leave).
  if (action === "CHECK_IN") {
    const settings = await getSettings();
    if ((settings.featureFlags as any)?.lockdownActive) {
      return fail(403, "Lockdown is active. No new entries permitted.");
    }
  }

  // 4. State machine — no double check-in, no check-out without a check-in.
  const last = await prisma.houseHelpLog.findFirst({
    where: { houseHelpId: help.id },
    orderBy: { createdAt: "desc" },
    select: { action: true },
  });
  const currentlyInside = last?.action === "CHECK_IN";
  if (action === "CHECK_IN" && currentlyInside) {
    return fail(409, `${help.name} is already checked in.`);
  }
  if (action === "CHECK_OUT" && !currentlyInside) {
    return fail(409, `${help.name} is not currently inside.`);
  }

  const log = await prisma.houseHelpLog.create({
    data: {
      houseHelpId: help.id,
      gateId,
      action,
      remarks,
    },
  });

  // Notify every employer whose quarter this helper is actively linked to.
  if (action === "CHECK_IN") {
    const links = await prisma.staffHouseHelp.findMany({
      where: { houseHelpId: help.id, isActive: true },
      select: { staffId: true },
    });
    for (const l of links) {
      void sendPushToUser(l.staffId, {
        title: "Helper checked in",
        body: `${help.name} checked in at the gate.`,
        data: { type: "HOUSE_HELP_CHECKIN", helpId: help.id },
      });
    }
  }

  return ok({
    success: true,
    action: log.action,
    timestamp: log.createdAt.toISOString(),
    message: `House Help ${help.name} ${action === "CHECK_IN" ? "Checked In" : "Checked Out"} successfully.`,
  });
}
