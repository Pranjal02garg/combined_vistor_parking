import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail } from "@/lib/server/http";

import { isOverstayTracked } from "@/lib/server/overstay";

export async function GET(req: Request) {
  const guard = await getGuard();
  if (!guard || guard.role !== "HEAD") return fail(401, "Unauthorized");

  const settings = await prisma.systemSettings.findUnique({ where: { id: "global" } });
  const globalOverstay = 120; // 120 minutes for Delivery & Vendors

  const categories = await prisma.formCategory.findMany({
    select: { key: true, overstayMinutes: true }
  });
  
  const categoryThresholds = Object.fromEntries(
    categories.map(c => [c.key, c.overstayMinutes || globalOverstay])
  );

  const activeVisits = await prisma.visitLog.findMany({
    where: { status: "APPROVED", exitedAt: null },
    include: {
      visitor: { select: { phone: true, name: true, overstayCount: true } },
      entryGate: { select: { name: true } }
    },
    orderBy: { approvedAt: "asc" }
  });

  const now = new Date();
  
  const overstays = activeVisits.filter(v => {
    if (!v.approvedAt) return false;
    // Only track overstays for Delivery and Vendor categories (guests are unlimited)
    if (!isOverstayTracked(v.category)) return false;
    const elapsedMinutes = Math.floor((now.getTime() - v.approvedAt.getTime()) / (1000 * 60));
    const threshold = categoryThresholds[v.category] || globalOverstay;
    return elapsedMinutes > threshold;
  }).map(v => {
    const elapsedMinutes = Math.floor((now.getTime() - v.approvedAt!.getTime()) / (1000 * 60));
    const threshold = categoryThresholds[v.category] || globalOverstay;
    return {
      id: v.id,
      visitorName: v.visitor.name,
      visitorPhone: v.visitor.phone,
      categoryLabel: v.categoryLabel,
      vehicleNumber: v.vehicleNumber,
      enteredAt: v.approvedAt,
      gateName: v.entryGate?.name || "Unknown",
      elapsedMinutes,
      thresholdMinutes: threshold,
      overstayMinutes: elapsedMinutes - threshold,
      repeatDefaulter: v.visitor.overstayCount > 0
    };
  });

  return ok(overstays);
}
