import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { guardLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { createVIPSchema } from "@/lib/validation/vip";
import { newVipToken, toVIPDTO, vipInclude } from "@/lib/server/vip";

// POST /api/vip — STAFF. Create a VIP pass (status PENDING) → returns the QR token.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "STAFF" && user.role !== "HEAD") return fail(403, "Staff or Admin only");
  if (!(await allow(guardLimiter, user.userId))) return fail(429, "Too many requests");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }
  const parsed = parseOr400(createVIPSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  // Derive the human-readable purpose and the routing, server-side (never trust
  // the client for routing). Only Official → VIP requests need HEAD approval;
  // everything else (Personal, Official → General) is auto-approved so the guard
  // can admit the guest directly by scanning the QR.
  const purpose =
    d.visitType === "PERSONAL"
      ? "Personal Guest"
      : `Official Guest${d.tier && d.tier !== "GUEST" ? ` (${d.tier})` : ""}`;

  const pass = await prisma.vIPPass.create({
    data: {
      token: newVipToken(),
      guestName: d.guestName,
      // Mobile number is optional; store an empty string when omitted.
      guestPhone: d.guestPhone ?? "",
      purpose,
      vehicleNumber: d.vehicleNumber
        ? d.vehicleNumber.toUpperCase()
        : null,
      validFrom: d.validFrom ? new Date(d.validFrom) : null,
      validUntil: d.validUntil ? new Date(d.validUntil) : null,
      hostStaffId: user.userId,
      // All staff passes are auto-approved for direct guard station action
      status: "APPROVED",
      approvedAt: new Date(),
    },
    include: vipInclude,
  });

  return ok(toVIPDTO(pass), { status: 201 });
}

// GET /api/vip — STAFF. The staff member's own passes + statuses.
export async function GET() {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "STAFF" && user.role !== "HEAD") return fail(403, "Staff or Admin only");

  const rows = await prisma.vIPPass.findMany({
    where: { hostStaffId: user.userId },
    include: vipInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok({ items: rows.map(toVIPDTO) });
}
