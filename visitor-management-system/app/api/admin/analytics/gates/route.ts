import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail } from "@/lib/server/http";

export async function GET(req: Request) {
  const head = await getGuard();
  if (head?.role !== "HEAD") return fail(403, "HEAD only");
  if (!head) return fail(401, "Not signed in");

  const url = new URL(req.url);
  const range = url.searchParams.get("range") || "7d"; // "today" | "7d" | "30d" | "all"

  // Compute time boundary
  let startDate: Date;
  if (range === "today") {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (range === "30d") {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60000);
  } else if (range === "all") {
    startDate = new Date(0);
  } else {
    // Default 7 days
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60000);
  }

  // 1. All Gates
  const allGates = await prisma.gate.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, location: true },
    orderBy: { code: "asc" },
  });

  // 2. Live Gate Occupancy (ACTIVE visits grouped by entryGateId)
  const activeVisits = await prisma.visitLog.groupBy({
    by: ["entryGateId"],
    where: { status: "APPROVED", exitedAt: null },
    _count: { id: true },
  });

  const activeGuests = await prisma.vIPPass.groupBy({
    by: ["entryGateId"],
    where: { status: "CHECKED_IN", exitedAt: null },
    _count: { id: true },
  });

  const activeVisitsMap = new Map(activeVisits.map((v) => [v.entryGateId, v._count.id]));
  const activeGuestsMap = new Map(activeGuests.map((v) => [v.entryGateId, v._count.id]));

  let totalActiveOnCampus = 0;
  const gateOccupancy = allGates.map((g) => {
    const stdCount = activeVisitsMap.get(g.id) || 0;
    const guestCount = activeGuestsMap.get(g.id) || 0;
    const total = stdCount + guestCount;
    totalActiveOnCampus += total;
    return {
      gateId: g.id,
      gateCode: g.code,
      gateName: g.name,
      standardInside: stdCount,
      guestsInside: guestCount,
      totalInside: total,
    };
  });

  // 3. Guard Sessions (Active within last 5 mins)
  const fiveMinsAgo = new Date(Date.now() - 5 * 60000);
  const rawGuardSessions = await prisma.guardSession.findMany({
    where: { lastPingAt: { gte: fiveMinsAgo } },
    include: { gate: { select: { code: true, name: true } } },
    orderBy: { lastPingAt: "desc" },
  });

  const guardSessions = rawGuardSessions.map((s) => ({
    id: s.id,
    guardName: s.guardName,
    gateName: s.gate.name,
    gateCode: s.gate.code,
    lastPingAt: s.lastPingAt.toISOString(),
  }));

  // 4. Category Analytics within selected range
  const categoryStatsRaw = await prisma.visitLog.groupBy({
    by: ["categoryLabel"],
    where: { createdAt: { gte: startDate } },
    _count: { id: true },
  });

  const totalEntriesInRange = categoryStatsRaw.reduce((sum, c) => sum + c._count.id, 0);

  const categoryStats = categoryStatsRaw
    .map((c) => ({
      categoryLabel: c.categoryLabel || "General Visit",
      count: c._count.id,
      percentage: totalEntriesInRange > 0 ? Math.round((c._count.id / totalEntriesInRange) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // 5. Gate Processing Performance Metrics
  const recentApproved = await prisma.visitLog.findMany({
    where: {
      status: { in: ["APPROVED", "EXITED"] },
      approvedAt: { not: null },
      createdAt: { gte: startDate },
    },
    select: {
      entryGateId: true,
      createdAt: true,
      approvedAt: true,
      entryGate: { select: { code: true, name: true } },
    },
  });

  const performanceMap: Record<string, { gateCode: string; gateName: string; totalSeconds: number; count: number; avgSeconds: number; speedRating: string }> = {};

  for (const v of recentApproved) {
    if (!v.entryGateId || !v.approvedAt || !v.entryGate) continue;
    const diff = Math.max(0, (v.approvedAt.getTime() - v.createdAt.getTime()) / 1000);

    if (!performanceMap[v.entryGateId]) {
      performanceMap[v.entryGateId] = {
        gateCode: v.entryGate.code,
        gateName: v.entryGate.name,
        totalSeconds: 0,
        count: 0,
        avgSeconds: 0,
        speedRating: "Fast",
      };
    }

    performanceMap[v.entryGateId].totalSeconds += diff;
    performanceMap[v.entryGateId].count += 1;
  }

  let totalLatencySeconds = 0;
  let totalLatencyCount = 0;

  Object.values(performanceMap).forEach((g) => {
    g.avgSeconds = g.count > 0 ? Math.round(g.totalSeconds / g.count) : 0;
    totalLatencySeconds += g.totalSeconds;
    totalLatencyCount += g.count;
    if (g.avgSeconds <= 30) g.speedRating = "Optimal (<30s)";
    else if (g.avgSeconds <= 60) g.speedRating = "Moderate (<60s)";
    else g.speedRating = "Heavy (>60s)";
  });

  const avgCampusWaitSeconds = totalLatencyCount > 0 ? Math.round(totalLatencySeconds / totalLatencyCount) : 0;

  return ok({
    range,
    totalActiveOnCampus,
    totalEntriesInRange,
    avgCampusWaitSeconds,
    activeGateCount: allGates.length,
    activeGuardCount: guardSessions.length,
    gateOccupancy,
    guardSessions,
    categoryStats,
    gatePerformance: Object.values(performanceMap).sort((a, b) => a.gateCode.localeCompare(b.gateCode)),
  });
}
