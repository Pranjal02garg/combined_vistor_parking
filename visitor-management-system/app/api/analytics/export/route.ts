import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { fail } from "@/lib/server/http";

export async function GET(req: Request) {
  const guard = await getGuard();
  if (!guard || guard.role !== "HEAD") return fail(401, "Unauthorized");

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "visits"; // visits, house_helps, incidents, defaulters
  const range = url.searchParams.get("range") || "all";
  const dateStr = url.searchParams.get("date");

  const now = new Date();
  let timeFilter: any = undefined;

  if (dateStr) {
    const start = new Date(dateStr);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    timeFilter = { gte: start, lt: end };
  } else if (range === "today") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    timeFilter = { gte: startOfDay };
  } else if (range === "7d") {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    timeFilter = { gte: sevenDaysAgo };
  } else if (range === "30d") {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    timeFilter = { gte: thirtyDaysAgo };
  }

  // 1. HOUSE HELPS EXPORT
  if (type === "house_helps") {
    const helps = await prisma.houseHelp.findMany({
      include: {
        registeredBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        staffLinks: {
          include: { staff: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const lines = [
      "Token,Helper Name,Phone,Service Type,ID Proof Type,ID Number,Clearance Status,Registered By,Approved By,Associated Staff Employers & Quarters,Created At"
    ];

    for (const h of helps) {
      const employersStr = h.staffLinks
        .map((l) => `${l.staff.name} (${l.quarterNumber}) [${l.isActive ? "Active" : "Paused"}]`)
        .join("; ");
      lines.push(
        [
          h.token,
          `"${h.name}"`,
          h.phone,
          h.serviceType,
          h.idProofType || "AADHAAR",
          `"${h.idProofNumber || ""}"`,
          h.status,
          `"${h.registeredBy?.name || ""}"`,
          `"${h.approvedBy?.name || ""}"`,
          `"${employersStr}"`,
          h.createdAt.toISOString(),
        ].join(",")
      );
    }

    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="campus-house-helps-export-${range}.csv"`,
      },
    });
  }

  // 2. INCIDENTS EXPORT
  if (type === "incidents") {
    const incidents = await prisma.incidentLog.findMany({
      where: timeFilter ? { createdAt: timeFilter } : undefined,
      include: {
        staff: { select: { name: true, email: true } },
        reportedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const lines = [
      "Incident ID,Title,Description,Severity,Quarter Number,Staff Name,Status,Reported By,Logged At,Resolved At,Resolution Notes"
    ];

    for (const inc of incidents) {
      lines.push(
        [
          inc.id,
          `"${inc.title.replace(/"/g, '""')}"`,
          `"${inc.description.replace(/"/g, '""')}"`,
          inc.severity,
          `"${inc.quarterNumber || ""}"`,
          `"${inc.staff?.name || ""}"`,
          inc.status,
          `"${inc.reportedBy?.name || ""}"`,
          inc.createdAt.toISOString(),
          inc.resolvedAt?.toISOString() || "",
          `"${(inc.resolution || "").replace(/"/g, '""')}"`,
        ].join(",")
      );
    }

    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="campus-security-incidents-${range}.csv"`,
      },
    });
  }

  // 3. VISITS & GATE PASSES EXPORT (Default)
  const query: any = timeFilter ? { createdAt: timeFilter } : {};

  const visits = await prisma.visitLog.findMany({
    where: query,
    include: {
      visitor: { select: { name: true, phone: true } },
      entryGate: { select: { name: true } },
      exitGate: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const vips = await prisma.vIPPass.findMany({
    where: query,
    include: {
      hostStaff: { select: { name: true } },
      entryGate: { select: { name: true } },
      exitGate: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const lines = [
    "Pass Type,Token/Code,Visitor Name,Phone,Category/Purpose,Vehicle Number,Status,Entry Gate,Exit Gate,Approved By Guard,Created At,Entered At,Exited At"
  ];

  for (const v of visits) {
    lines.push(
      [
        "Standard",
        v.referenceCode,
        `"${v.visitor.name}"`,
        v.visitor.phone,
        `"${v.categoryLabel || v.category}"`,
        `"${v.vehicleNumber || ""}"`,
        v.status,
        `"${v.entryGate?.name || ""}"`,
        `"${v.exitGate?.name || ""}"`,
        `"${v.onDutyGuard || ""}"`,
        v.createdAt.toISOString(),
        v.approvedAt?.toISOString() || "",
        v.exitedAt?.toISOString() || "",
      ].join(",")
    );
  }

  for (const v of vips) {
    lines.push(
      [
        "Guest Pass",
        v.token,
        `"${v.guestName}"`,
        v.guestPhone,
        `"${v.purpose}"`,
        `"${v.vehicleNumber || ""}"`,
        v.status,
        `"${v.entryGate?.name || ""}"`,
        `"${v.exitGate?.name || ""}"`,
        `"${v.onDutyGuard || ""}"`,
        v.createdAt.toISOString(),
        v.enteredAt?.toISOString() || "",
        v.exitedAt?.toISOString() || "",
      ].join(",")
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="campus-gate-visits-${range}.csv"`,
    },
  });
}
