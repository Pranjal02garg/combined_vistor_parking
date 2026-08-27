import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail } from "@/lib/server/http";
import { getSettings } from "@/lib/server/settings";
import { getActiveBlacklistPhones } from "@/lib/server/blacklist";
import { minutesInside, isOverstaying } from "@/lib/server/overstay";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/visits/active — Unified list of visitors currently on campus
export async function GET() {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "GUARD" && user.role !== "HEAD") {
    return fail(403, "Forbidden");
  }
  if (!(await allow(guardLimiter, user.userId))) {
    return fail(429, "Too many requests");
  }

  const settings = await getSettings();

  // Fetch standard active visits
  const standardLogs = await prisma.visitLog.findMany({
    where: {
      status: { in: ["APPROVED", "ESCALATED"] },
      exitedAt: null,
    },
    include: {
      visitor: true,
      entryGate: true,
    },
    orderBy: { approvedAt: "desc" },
    take: 100,
  });

  // Fetch active checked-in VIP passes
  const vipPasses = await prisma.vIPPass.findMany({
    where: {
      status: "CHECKED_IN",
      exitedAt: null,
    },
    include: {
      entryGate: true,
    },
    orderBy: { enteredAt: "desc" },
    take: 100,
  });

  const phones = [
    ...standardLogs.map((log) => log.visitor.phone),
    ...vipPasses.map((pass) => pass.guestPhone),
  ];
  const blacklistedSet = await getActiveBlacklistPhones(phones);

  // Map to unified DTOs
  const standardItems = standardLogs.map((log) => {
    const enteredAtStr = log.approvedAt
      ? log.approvedAt.toISOString()
      : log.createdAt.toISOString();
    const enteredTime = log.approvedAt || log.createdAt;
    return {
      id: log.id,
      type: "STANDARD",
      name: log.visitor.name,
      phone: log.visitor.phone,
      vehicleNumber: log.vehicleNumber,
      category: log.category,
      entryGateName: log.entryGate.name,
      entryGateCode: log.entryGate.code,
      enteredAt: enteredAtStr,
      referenceCode: log.referenceCode,
      minutesInside: minutesInside(enteredTime),
      overstaying: isOverstaying(enteredTime, settings.overstayMinutes),
      blacklisted: blacklistedSet.has(log.visitor.phone),
    };
  });

  const vipItems = vipPasses.map((pass) => {
    const enteredAtStr = pass.enteredAt
      ? pass.enteredAt.toISOString()
      : pass.createdAt.toISOString();
    const enteredTime = pass.enteredAt || pass.createdAt;
    return {
      id: pass.id,
      type: "VIP",
      name: pass.guestName,
      phone: pass.guestPhone,
      vehicleNumber: pass.vehicleNumber,
      category: "VIP",
      entryGateName: pass.entryGate?.name ?? "Gate 1",
      entryGateCode: pass.entryGate?.code ?? "1",
      enteredAt: enteredAtStr,
      referenceCode: pass.token,
      minutesInside: minutesInside(enteredTime),
      overstaying: isOverstaying(enteredTime, settings.overstayMinutes),
      blacklisted: blacklistedSet.has(pass.guestPhone),
    };
  });

  // Combine and sort by entry time (newest first)
  const combined = [...standardItems, ...vipItems].sort(
    (a, b) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime()
  );

  return ok({ items: combined });
}
