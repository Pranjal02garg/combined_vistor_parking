import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail } from "@/lib/server/http";

const CATEGORIES = [
  "PARENT",
  "DELIVERY_VENDOR",
  "TAXI",
  "CONTRACTOR",
  "OFFICIAL",
  "STAFF",
  "RESIDENT",
  "OTHERS",
] as const;

// Resolve [start, end) day bounds from an optional YYYY-MM-DD (default today).
function dayBounds(dateStr: string | null): { start: Date; end: Date } {
  const base =
    dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? new Date(`${dateStr}T00:00:00`)
      : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// groupBy rows → Map<gateId, count>, skipping null gate keys.
function mapByGate(
  rows: Array<Record<string, unknown> & { _count: number }>,
  key: "entryGateId" | "exitGateId"
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const id = r[key];
    if (typeof id === "string") m.set(id, r._count);
  }
  return m;
}

// GET /api/analytics/dashboard — HEAD only. Executive KPIs, counts only (no PII/ids).
export async function GET(req: Request) {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD") return fail(403, "HEAD only");
  if (!(await allow(guardLimiter, user.userId))) return fail(429, "Too many requests");

  const { searchParams } = new URL(req.url);
  const { start, end } = dayBounds(searchParams.get("date"));
  const inRange = { gte: start, lt: end };

  const { getSettings } = await import("@/lib/server/settings");
  const settings = await getSettings();
  const overstayLimitDate = new Date(
    Date.now() - settings.overstayMinutes * 60 * 1000
  );

  const [
    stdEntries,
    vipEntries,
    stdOnCampus,
    vipOnCampus,
    stdExits,
    vipExits,
    escalatedAlerts,
    categoryGroups,
    vipPending,
    vipApprovedUnscanned,
    gates,
    stdEntryByGate,
    stdExitByGate,
    vipEntryByGate,
    vipExitByGate,
    stdOverstaying,
    vipOverstaying,
  ] = await Promise.all([
    prisma.visitLog.count({ where: { approvedAt: inRange } }),
    prisma.vIPPass.count({ where: { enteredAt: inRange } }),
    prisma.visitLog.count({ where: { status: "APPROVED", exitedAt: null } }),
    prisma.vIPPass.count({ where: { status: "CHECKED_IN", exitedAt: null } }),
    prisma.visitLog.count({ where: { exitedAt: inRange } }),
    prisma.vIPPass.count({ where: { exitedAt: inRange } }),
    prisma.visitLog.count({ where: { status: "ESCALATED" } }),
    prisma.visitLog.groupBy({
      by: ["category"],
      where: { createdAt: inRange },
      _count: true,
    }),
    prisma.vIPPass.count({ where: { status: "PENDING" } }),
    prisma.vIPPass.count({ where: { status: "APPROVED", enteredAt: null } }),
    prisma.gate.findMany({ select: { id: true, code: true }, orderBy: { code: "asc" } }),
    prisma.visitLog.groupBy({ by: ["entryGateId"], where: { approvedAt: inRange }, _count: true }),
    prisma.visitLog.groupBy({ by: ["exitGateId"], where: { exitedAt: inRange }, _count: true }),
    prisma.vIPPass.groupBy({ by: ["entryGateId"], where: { enteredAt: inRange }, _count: true }),
    prisma.vIPPass.groupBy({ by: ["exitGateId"], where: { exitedAt: inRange }, _count: true }),
    prisma.visitLog.count({
      where: { status: "APPROVED", exitedAt: null, approvedAt: { lt: overstayLimitDate } },
    }),
    prisma.vIPPass.count({
      where: { status: "CHECKED_IN", exitedAt: null, enteredAt: { lt: overstayLimitDate } },
    }),
  ]);

  const catMap = new Map(
    categoryGroups.map((g) => [g.category as string, g._count])
  );
  const categoryBreakdown = CATEGORIES.map((category) => ({
    category,
    count: catMap.get(category) ?? 0,
  }));

  const stdEntryMap = mapByGate(stdEntryByGate, "entryGateId");
  const vipEntryMap = mapByGate(vipEntryByGate, "entryGateId");
  const stdExitMap = mapByGate(stdExitByGate, "exitGateId");
  const vipExitMap = mapByGate(vipExitByGate, "exitGateId");
  const gateThroughput = gates.map((g) => ({
    gateCode: g.code,
    entries: (stdEntryMap.get(g.id) ?? 0) + (vipEntryMap.get(g.id) ?? 0),
    exits: (stdExitMap.get(g.id) ?? 0) + (vipExitMap.get(g.id) ?? 0),
  }));

  return ok({
    summary: {
      totalCheckedIn: stdEntries + vipEntries,
      currentlyOnCampus: stdOnCampus + vipOnCampus,
      totalExited: stdExits + vipExits,
      escalatedAlerts,
      currentlyOverstaying: stdOverstaying + vipOverstaying,
    },
    categoryBreakdown,
    vipMetrics: {
      pending: vipPending,
      approvedUnscanned: vipApprovedUnscanned,
      activeOnCampus: vipOnCampus,
    },
    gateThroughput,
  });
}
