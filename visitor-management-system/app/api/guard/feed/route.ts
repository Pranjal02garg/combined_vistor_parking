import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail } from "@/lib/server/http";
import { getSettings } from "@/lib/server/settings";
import { getActiveBlacklistPhones } from "@/lib/server/blacklist";
import { minutesInside, isOverstaying } from "@/lib/server/overstay";

// Never cache — the guard console must always see fresh traffic.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface FeedItem {
  key: string;
  kind: "NORMAL" | "VIP";
  state: "ACTIVE" | "PENDING" | "PAST";
  status: string;
  visitId: string | null;
  ref: string;
  name: string;
  phone: string;
  vehicleNumber: string | null;
  categoryLabel: string;
  category: string; // stable category key (or "VIP") — drives guard color coding
  selfieUrl: string | null;
  entryGateName: string | null;
  entryGateId: string | null;
  minutesInside: number | null;
  overstaying: boolean;
  blacklisted: boolean;
  awaitingHead: boolean;
  createdAt: string; // when the request was generated
  fields: Array<{ label: string; value: string }>; // full parsed form for the details modal
  sortTs: number; // internal: entry time (active) or submit time (pending)
}

function normalFields(v: {
  fieldsSnapshot: unknown;
  details: unknown;
  onDutyGuard?: string | null;
}): Array<{ label: string; value: string }> {
  let f: Array<{ label: string; value: string }> = [];
  if (Array.isArray(v.fieldsSnapshot)) {
    f = (v.fieldsSnapshot as Array<{ label: string; value: string }>).filter(
      (field) => field && field.label
    );
  } else {
    const d = (v.details ?? {}) as Record<string, unknown>;
    f = Object.entries(d).map(([label, value]) => ({ label, value: String(value) }));
  }
  if (v.onDutyGuard && v.onDutyGuard !== "unnamed") {
    f.push({ label: "Approved by Guard", value: v.onDutyGuard });
  }
  return f;
}

function vipFields(p: {
  purpose: string;
  vehicleNumber: string | null;
  validUntil: Date | null;
  onDutyGuard?: string | null;
}): Array<{ label: string; value: string }> {
  const f = [{ label: "Purpose", value: p.purpose }];
  if (p.vehicleNumber) f.push({ label: "Vehicle", value: p.vehicleNumber });
  if (p.validUntil)
    f.push({ label: "Valid until", value: new Date(p.validUntil).toLocaleString() });
  if (p.onDutyGuard && p.onDutyGuard !== "unnamed") {
    f.push({ label: "Approved by Guard", value: p.onDutyGuard });
  }
  return f;
}

// GET /api/guard/feed — GUARD/HEAD. One campus-wide, pre-sorted master feed
// combining normal + VIP, active + pending. Powers the Live Traffic tab.
export async function GET() {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "GUARD" && user.role !== "HEAD") return fail(403, "Forbidden");
  if (!(await allow(guardLimiter, user.userId))) return fail(429, "Too many requests");

  const settings = await getSettings();
  const overstayMin = settings.overstayMinutes;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [normalActive, normalPending, vipActive, vipPending, normalPast, vipPast] = await Promise.all([
    prisma.visitLog.findMany({
      where: { status: "APPROVED", exitedAt: null },
      include: { visitor: true, entryGate: true },
      orderBy: { approvedAt: "desc" },
      take: 200,
    }),
    prisma.visitLog.findMany({
      where: { status: { in: ["PENDING", "ESCALATED"] } },
      include: { visitor: true, entryGate: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.vIPPass.findMany({
      where: { status: "CHECKED_IN", exitedAt: null },
      include: { entryGate: true },
      orderBy: { enteredAt: "desc" },
      take: 200,
    }),
    prisma.vIPPass.findMany({
      where: { status: { in: ["PENDING", "APPROVED"] }, enteredAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.visitLog.findMany({
      where: { status: { in: ["EXITED", "REJECTED"] }, createdAt: { gte: today } },
      include: { visitor: true, entryGate: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.vIPPass.findMany({
      where: { status: { in: ["EXITED", "REJECTED", "EXPIRED"] }, createdAt: { gte: today } },
      include: { entryGate: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const phones = [
    ...normalActive.map((v) => v.visitor.phone),
    ...normalPending.map((v) => v.visitor.phone),
    ...normalPast.map((v) => v.visitor.phone),
    ...vipActive.map((v) => v.guestPhone),
    ...vipPending.map((v) => v.guestPhone),
    ...vipPast.map((v) => v.guestPhone),
  ];
  const blacklisted = await getActiveBlacklistPhones(phones);

  const items: FeedItem[] = [];

  for (const v of normalActive) {
    const entered = v.approvedAt ?? v.createdAt;
    items.push({
      key: `n-${v.id}`,
      kind: "NORMAL",
      state: "ACTIVE",
      status: v.status,
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
      minutesInside: minutesInside(entered),
      overstaying: isOverstaying(entered, 120, v.category),
      blacklisted: blacklisted.has(v.visitor.phone),
      awaitingHead: false,
      createdAt: v.createdAt.toISOString(),
      fields: normalFields(v),
      sortTs: new Date(entered).getTime(),
    });
  }

  for (const v of normalPending) {
    items.push({
      key: `n-${v.id}`,
      kind: "NORMAL",
      state: "PENDING",
      status: v.status,
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
      minutesInside: null,
      overstaying: false,
      blacklisted: blacklisted.has(v.visitor.phone),
      awaitingHead: false,
      createdAt: v.createdAt.toISOString(),
      fields: normalFields(v),
      sortTs: new Date(v.createdAt).getTime(),
    });
  }

  for (const v of normalPast) {
    items.push({
      key: `n-${v.id}`,
      kind: "NORMAL",
      state: "PAST",
      status: v.status,
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
      minutesInside: v.status === "EXITED" && v.exitedAt && v.approvedAt ? minutesInside(v.approvedAt, v.exitedAt) : null,
      overstaying: false,
      blacklisted: blacklisted.has(v.visitor.phone),
      awaitingHead: false,
      createdAt: v.createdAt.toISOString(),
      fields: normalFields(v),
      sortTs: new Date(v.createdAt).getTime(),
    });
  }

  for (const p of vipActive) {
    const entered = p.enteredAt ?? p.createdAt;
    items.push({
      key: `v-${p.id}`,
      kind: "VIP",
      state: "ACTIVE",
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
      minutesInside: minutesInside(entered),
      overstaying: false,
      blacklisted: blacklisted.has(p.guestPhone),
      awaitingHead: false,
      createdAt: p.createdAt.toISOString(),
      fields: vipFields(p),
      sortTs: new Date(entered).getTime(),
    });
  }

  for (const p of vipPending) {
    items.push({
      key: `v-${p.id}`,
      kind: "VIP",
      state: "PENDING",
      status: p.status,
      visitId: p.id,
      ref: p.token,
      name: p.guestName,
      phone: p.guestPhone,
      vehicleNumber: p.vehicleNumber,
      categoryLabel: "Official Guest",
      category: "GUEST",
      selfieUrl: null,
      entryGateName: null,
      entryGateId: null,
      minutesInside: null,
      overstaying: false,
      blacklisted: blacklisted.has(p.guestPhone),
      awaitingHead: p.status === "PENDING",
      createdAt: p.createdAt.toISOString(),
      fields: vipFields(p),
      sortTs: new Date(p.createdAt).getTime(),
    });
  }

  for (const p of vipPast) {
    items.push({
      key: `v-${p.id}`,
      kind: "VIP",
      state: "PAST",
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
      minutesInside: p.status === "EXITED" && p.exitedAt && p.enteredAt ? minutesInside(p.enteredAt, p.exitedAt) : null,
      overstaying: false,
      blacklisted: blacklisted.has(p.guestPhone),
      awaitingHead: false,
      createdAt: p.createdAt.toISOString(),
      fields: vipFields(p),
      sortTs: new Date(p.createdAt).getTime(),
    });
  }

  // Sort: ACTIVE before PENDING; blacklisted floats up within a group; then
  // active by overstaying/longest-inside, pending by newest.
  const stateRank = (s: FeedItem["state"]) => (s === "ACTIVE" ? 0 : 1);
  items.sort((a, b) => {
    if (stateRank(a.state) !== stateRank(b.state))
      return stateRank(a.state) - stateRank(b.state);
    if (a.blacklisted !== b.blacklisted) return a.blacklisted ? -1 : 1;
    if (a.state === "ACTIVE" && a.overstaying !== b.overstaying)
      return a.overstaying ? -1 : 1;
    // active: longest inside first (older entry ts first); pending: newest first
    return a.state === "ACTIVE" ? a.sortTs - b.sortTs : b.sortTs - a.sortTs;
  });

  const flags = settings.featureFlags as any;
  let broadcastMsg = flags?.broadcastMessage || null;
  const scheduledFor = flags?.broadcastScheduledFor;
  if (broadcastMsg && scheduledFor) {
    if (new Date() < new Date(scheduledFor)) {
      broadcastMsg = null; // not time yet
    }
  }

  return ok({ items, broadcast: { message: broadcastMsg, priority: flags?.broadcastPriority || "normal" }, lockdown: { active: Boolean(flags?.lockdownActive), reason: flags?.lockdownReason || "" } });
}
