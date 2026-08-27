import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail } from "@/lib/server/http";
import { getSettings } from "@/lib/server/settings";
import { isPhoneBlacklisted } from "@/lib/server/blacklist";
import { minutesInside, isOverstaying } from "@/lib/server/overstay";
import type { FeedItem } from "@/app/api/guard/feed/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/guard/lookup?code= — GUARD/HEAD. Resolve a scanned VIP token or normal
// reference code to a single card (same shape as the feed).
export async function GET(req: Request) {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "GUARD" && user.role !== "HEAD") return fail(403, "Forbidden");
  if (!(await allow(guardLimiter, user.userId))) return fail(429, "Too many requests");

  const raw = new URL(req.url).searchParams.get("code") ?? "";
  let extracted = raw.trim();
  if (extracted.includes("/pass/")) {
    extracted = extracted.split("/pass/").pop()?.split("?")[0]?.split("#")[0] ?? extracted;
  }
  const code = extracted.trim().toUpperCase();
  if (!code || code.length > 64) return fail(400, "Bad code");

  const settings = await getSettings();
  const isVip = code.startsWith("GST") || code.startsWith("VIP");
  const isHelp = code.startsWith("HLP");

  if (isHelp) {
    const h = await prisma.houseHelp.findUnique({
      where: { token: code },
      include: {
        registeredBy: { select: { name: true } },
        staffLinks: {
          include: {
            staff: { select: { name: true } },
          },
        },
      },
    });
    if (!h) return fail(404, "House Help pass not found");

    const now = new Date();
    const validLinks = h.staffLinks.filter((l) => l.isActive && l.validUntil >= now);
    const isApproved = h.status === "APPROVED";
    const isValid = validLinks.length > 0 && isApproved;
    const isBlacklisted = await isPhoneBlacklisted(h.phone);

    const item: FeedItem = {
      key: `h-${h.id}`,
      kind: "HOUSE_HELP" as any,
      state: isValid ? "ACTIVE" : "PENDING",
      status: isApproved ? (validLinks.length > 0 ? "APPROVED" : "EXPIRED") : h.status,
      visitId: h.id,
      ref: h.token,
      name: h.name,
      phone: h.phone,
      vehicleNumber: null,
      categoryLabel: `House Help (${h.serviceType})`,
      category: "HOUSE_HELP",
      selfieUrl: h.photoUrl,
      entryGateName: null,
      entryGateId: null,
      minutesInside: null,
      overstaying: false,
      blacklisted: isBlacklisted,
      awaitingHead: h.status === "PENDING_APPROVAL",
      createdAt: h.createdAt.toISOString(),
      fields: [
        { label: "Service Category", value: h.serviceType },
        {
          label: "Clearance Status",
          value:
            h.status === "APPROVED"
              ? isValid
                ? "🟢 APPROVED & ACTIVE"
                : "⛔ EXPIRED / PAUSED BY STAFF"
              : `⚠️ Awaiting Head Clearance (${h.status})`,
        },
        ...h.staffLinks.map((l) => ({
          label: `Employer: ${l.staff.name}`,
          value: `${l.quarterNumber} • ${l.isActive && l.validUntil >= now ? `Valid until ${new Date(l.validUntil).toLocaleDateString()}` : "⛔ Expired / Paused"}`,
        })),
      ],
      sortTs: Date.now(),
    };
    return ok({ item });
  }

  if (isVip) {
    const p = await prisma.vIPPass.findUnique({
      where: { token: code },
      include: { entryGate: true },
    });
    if (!p) return fail(404, "Pass not found");
    const active = p.status === "CHECKED_IN" && !p.exitedAt;
    const entered = p.enteredAt ?? p.createdAt;
    const item: FeedItem = {
      key: `v-${p.id}`,
      kind: "VIP",
      state: active ? "ACTIVE" : "PENDING",
      status: p.status,
      visitId: p.id,
      ref: p.token,
      name: p.guestName,
      phone: p.guestPhone,
      vehicleNumber: p.vehicleNumber,
      categoryLabel: "Official Guest",
      category: "GUEST",
      selfieUrl: null,
      entryGateName: p.entryGate?.name ?? null,
      entryGateId: p.entryGate?.id ?? null,
      minutesInside: active ? minutesInside(entered) : null,
      overstaying: false,
      blacklisted: await isPhoneBlacklisted(p.guestPhone),
      awaitingHead: p.status === "PENDING",
      createdAt: p.createdAt.toISOString(),
      fields: [
        { label: "Purpose", value: p.purpose },
        ...(p.vehicleNumber ? [{ label: "Vehicle", value: p.vehicleNumber }] : []),
        ...(p.validUntil
          ? [{ label: "Valid until", value: new Date(p.validUntil).toLocaleString() }]
          : []),
        ...(p.onDutyGuard && p.onDutyGuard !== "unnamed" ? [{ label: "Approved by Guard", value: p.onDutyGuard }] : []),
      ],
      sortTs: Date.now(),
    };
    return ok({ item });
  }

  const v = await prisma.visitLog.findUnique({
    where: { referenceCode: code },
    include: { visitor: true, entryGate: true },
  });
  if (!v) return fail(404, "Visit not found");
  
  const isDayPass = v.category === "DELIVERY" || v.category === "VENDOR";
  // If active on campus right now
  const active = v.status === "APPROVED" && !v.exitedAt;
  const isExitedDayPass = isDayPass && v.exitedAt;

  const entered = v.approvedAt ?? v.createdAt;
  const item: FeedItem = {
    key: `n-${v.id}`,
    kind: "NORMAL",
    state: active ? "ACTIVE" : "PENDING",
    status: isExitedDayPass ? "PENDING" : v.status,
    visitId: v.id,
    ref: v.referenceCode,
    name: v.visitor.name,
    phone: v.visitor.phone,
    vehicleNumber: v.vehicleNumber,
    categoryLabel: v.categoryLabel ?? v.category,
    category: v.category,
    selfieUrl: v.selfieUrl,
    entryGateName: v.entryGate.name,
    entryGateId: v.entryGate.id,
    minutesInside: active ? minutesInside(entered) : null,
    overstaying: active ? isOverstaying(entered, 120, v.category) : false,
    blacklisted: await isPhoneBlacklisted(v.visitor.phone),
    awaitingHead: false,
    createdAt: v.createdAt.toISOString(),
    fields: (() => {
      let f: Array<{ label: string; value: string }> = [];
      if (Array.isArray(v.fieldsSnapshot)) {
        f = (v.fieldsSnapshot as Array<{ label: string; value: string }>).filter(x => x && x.label);
      } else {
        f = Object.entries((v.details ?? {}) as Record<string, unknown>).map(
          ([label, value]) => ({ label, value: String(value) })
        );
      }
      if (v.onDutyGuard && v.onDutyGuard !== "unnamed") {
        f.push({ label: "Approved by Guard", value: v.onDutyGuard });
      }
      return f;
    })(),
    sortTs: Date.now(),
  };
  return ok({ item });
}
