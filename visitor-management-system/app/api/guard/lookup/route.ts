import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail } from "@/lib/server/http";
import { isPhoneBlacklisted } from "@/lib/server/blacklist";
import { minutesInside, isOverstaying } from "@/lib/server/overstay";
import type { FeedItem } from "@/app/api/guard/feed/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Helper to intelligently clean and extract token from any QR code payload or URL
function extractSearchCode(raw: string): string {
  if (!raw) return "";
  let s = decodeURIComponent(raw).trim();

  // If payload contains data=, extract it
  if (s.includes("data=")) {
    s = s.split("data=")[1].split("&")[0].split("#")[0];
  }
  // If payload contains token=, extract it
  if (s.includes("token=")) {
    s = s.split("token=")[1].split("&")[0].split("#")[0];
  }
  // If payload contains /pass/, extract it
  if (s.includes("/pass/")) {
    s = s.split("/pass/").pop()?.split("?")[0]?.split("#")[0] || s;
  }
  // If payload contains /vehicle/, extract it
  if (s.includes("/vehicle/")) {
    s = s.split("/vehicle/").pop()?.split("?")[0]?.split("#")[0] || s;
  }
  // If it's a URL, get the last segment
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("exp://")) {
    try {
      const u = new URL(s);
      const last = u.pathname.split("/").filter(Boolean).pop();
      if (last) s = last;
    } catch {}
  }
  return s.trim().toUpperCase();
}

export async function GET(req: Request) {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "GUARD" && user.role !== "HEAD") return fail(403, "Forbidden");
  if (!(await allow(guardLimiter, user.userId))) return fail(429, "Too many requests");

  const raw = new URL(req.url).searchParams.get("code") ?? "";
  const code = extractSearchCode(raw);
  if (!code || code.length > 128) return fail(400, "Bad code");

  // 1. Check VIP / Guest Pass
  const vipPass = await prisma.vIPPass.findFirst({
    where: {
      OR: [
        { token: code },
        { token: raw.trim().toUpperCase() },
        { vehicleNumber: code },
        { guestPhone: code },
      ],
    },
    include: { entryGate: true, hostStaff: { select: { name: true } } },
  });

  if (vipPass) {
    const active = vipPass.status === "CHECKED_IN" && !vipPass.exitedAt;
    const entered = vipPass.enteredAt ?? vipPass.createdAt;
    const item: FeedItem = {
      key: `v-${vipPass.id}`,
      kind: "VIP",
      state: active ? "ACTIVE" : "PENDING",
      status: vipPass.status,
      visitId: vipPass.id,
      ref: vipPass.token,
      name: vipPass.guestName,
      phone: vipPass.guestPhone,
      vehicleNumber: vipPass.vehicleNumber,
      categoryLabel: "Official Guest",
      category: "GUEST",
      selfieUrl: null,
      entryGateName: vipPass.entryGate?.name ?? null,
      entryGateId: vipPass.entryGate?.id ?? null,
      minutesInside: active ? minutesInside(entered) : null,
      overstaying: false,
      blacklisted: await isPhoneBlacklisted(vipPass.guestPhone),
      awaitingHead: vipPass.status === "PENDING",
      createdAt: vipPass.createdAt.toISOString(),
      fields: [
        { label: "Host Staff", value: vipPass.hostStaff?.name || "Faculty Member" },
        { label: "Purpose", value: vipPass.purpose },
        ...(vipPass.vehicleNumber ? [{ label: "Vehicle", value: vipPass.vehicleNumber }] : []),
        ...(vipPass.validUntil
          ? [{ label: "Valid until", value: new Date(vipPass.validUntil).toLocaleString() }]
          : []),
        ...(vipPass.onDutyGuard && vipPass.onDutyGuard !== "unnamed"
          ? [{ label: "Approved by Guard", value: vipPass.onDutyGuard }]
          : []),
      ],
      sortTs: Date.now(),
    };
    return ok({ item });
  }

  // 2. Check House Help Pass
  const houseHelp = await prisma.houseHelp.findFirst({
    where: {
      OR: [
        { token: code },
        { token: raw.trim().toUpperCase() },
        { phone: code },
      ],
    },
    include: {
      registeredBy: { select: { name: true } },
      staffLinks: {
        include: {
          staff: { select: { name: true } },
        },
      },
    },
  });

  if (houseHelp) {
    const now = new Date();
    const validLinks = houseHelp.staffLinks.filter((l) => l.isActive && l.validUntil >= now);
    const isApproved = houseHelp.status === "APPROVED";
    const isValid = validLinks.length > 0 && isApproved;
    const isBlacklisted = await isPhoneBlacklisted(houseHelp.phone);

    const item: FeedItem = {
      key: `h-${houseHelp.id}`,
      kind: "HOUSE_HELP" as any,
      state: isValid ? "ACTIVE" : "PENDING",
      status: isApproved ? (validLinks.length > 0 ? "APPROVED" : "EXPIRED") : houseHelp.status,
      visitId: houseHelp.id,
      ref: houseHelp.token,
      name: houseHelp.name,
      phone: houseHelp.phone,
      vehicleNumber: null,
      categoryLabel: `House Help (${houseHelp.serviceType})`,
      category: "HOUSE_HELP",
      selfieUrl: houseHelp.photoUrl,
      entryGateName: null,
      entryGateId: null,
      minutesInside: null,
      overstaying: false,
      blacklisted: isBlacklisted,
      awaitingHead: houseHelp.status === "PENDING_APPROVAL",
      createdAt: houseHelp.createdAt.toISOString(),
      fields: [
        { label: "Service Category", value: houseHelp.serviceType },
        {
          label: "Clearance Status",
          value:
            houseHelp.status === "APPROVED"
              ? isValid
                ? "🟢 APPROVED & ACTIVE"
                : "⛔ EXPIRED / PAUSED BY STAFF"
              : `⚠️ Awaiting Head Clearance (${houseHelp.status})`,
        },
        ...houseHelp.staffLinks.map((l) => ({
          label: `Employer: ${l.staff.name}`,
          value: `${l.quarterNumber} • ${
            l.isActive && l.validUntil >= now
              ? `Valid until ${new Date(l.validUntil).toLocaleDateString()}`
              : "⛔ Expired / Paused"
          }`,
        })),
      ],
      sortTs: Date.now(),
    };
    return ok({ item });
  }

  // 3. Check Normal Visit Log
  const visit = await prisma.visitLog.findFirst({
    where: {
      OR: [
        { referenceCode: code },
        { referenceCode: raw.trim().toUpperCase() },
        { vehicleNumber: code },
        { visitor: { phone: code } },
      ],
    },
    include: { visitor: true, entryGate: true },
  });

  if (visit) {
    const isDayPass = visit.category === "DELIVERY" || visit.category === "VENDOR";
    const active = visit.status === "APPROVED" && !visit.exitedAt;
    const isExitedDayPass = isDayPass && visit.exitedAt;
    const entered = visit.approvedAt ?? visit.createdAt;

    const item: FeedItem = {
      key: `n-${visit.id}`,
      kind: "NORMAL",
      state: active ? "ACTIVE" : "PENDING",
      status: isExitedDayPass ? "PENDING" : visit.status,
      visitId: visit.id,
      ref: visit.referenceCode,
      name: visit.visitor.name,
      phone: visit.visitor.phone,
      vehicleNumber: visit.vehicleNumber,
      categoryLabel: visit.categoryLabel ?? visit.category,
      category: visit.category,
      selfieUrl: visit.selfieUrl,
      entryGateName: visit.entryGate.name,
      entryGateId: visit.entryGate.id,
      minutesInside: active ? minutesInside(entered) : null,
      overstaying: active ? isOverstaying(entered, 120, visit.category) : false,
      blacklisted: await isPhoneBlacklisted(visit.visitor.phone),
      awaitingHead: false,
      createdAt: visit.createdAt.toISOString(),
      fields: (() => {
        let f: Array<{ label: string; value: string }> = [];
        if (Array.isArray(visit.fieldsSnapshot)) {
          f = (visit.fieldsSnapshot as Array<{ label: string; value: string }>).filter(
            (x) => x && x.label
          );
        } else {
          f = Object.entries((visit.details ?? {}) as Record<string, unknown>).map(
            ([label, value]) => ({ label, value: String(value) })
          );
        }
        if (visit.onDutyGuard && visit.onDutyGuard !== "unnamed") {
          f.push({ label: "Approved by Guard", value: visit.onDutyGuard });
        }
        return f;
      })(),
      sortTs: Date.now(),
    };
    return ok({ item });
  }

  // 4. Check Faculty Vehicle Allowlist (model is FacultyVehicle, owner via user relation)
  const vehicle = await prisma.facultyVehicle.findFirst({
    where: { plateNumber: code, isActive: true },
    include: { user: { select: { name: true, phone: true, department: true } } },
  });

  if (vehicle) {
    const item: FeedItem = {
      key: `veh-${vehicle.id}`,
      kind: "NORMAL",
      state: "ACTIVE",
      status: "APPROVED",
      visitId: vehicle.id,
      ref: vehicle.plateNumber,
      name: vehicle.user?.name ?? "Faculty Member",
      phone: vehicle.user?.phone ?? "",
      vehicleNumber: vehicle.plateNumber,
      categoryLabel: `Faculty Vehicle (${vehicle.stickerColor.toUpperCase()})`,
      category: "FACULTY",
      selfieUrl: null,
      entryGateName: "Fast-Lane ANPR",
      entryGateId: null,
      minutesInside: null,
      overstaying: false,
      blacklisted: false,
      awaitingHead: false,
      createdAt: vehicle.createdAt.toISOString(),
      fields: [
        { label: "Owner", value: vehicle.user?.name ?? "Faculty Member" },
        { label: "Department", value: vehicle.user?.department || "Faculty" },
        { label: "Permit Tier", value: `${vehicle.stickerColor.toUpperCase()} Fast-Lane` },
        { label: "Model", value: vehicle.modelName || "Registered Vehicle" },
      ],
      sortTs: Date.now(),
    };
    return ok({ item });
  }

  return fail(404, "Pass not found");
}
