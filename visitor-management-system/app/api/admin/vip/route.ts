import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { adminCreateVIPSchema } from "@/lib/validation/vip";
import { newVipToken, toVIPDTO, vipInclude } from "@/lib/server/vip";

async function requireHead() {
  const user = await getGuard();
  if (!user) return { res: fail(401, "Not signed in") };
  if (user.role !== "HEAD") return { res: fail(403, "HEAD only") };
  return { user };
}

// POST /api/admin/vip — HEAD. Create an auto-approved VIP pass.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const parsed = parseOr400(adminCreateVIPSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  const now = new Date();
  const pass = await prisma.vIPPass.create({
    data: {
      token: newVipToken(),
      guestName: d.guestName,
      guestPhone: d.guestPhone ?? "",
      purpose: d.purpose,
      vehicleNumber: d.vehicleNumber ? d.vehicleNumber.toUpperCase() : null,
      validFrom: d.validFrom ? new Date(d.validFrom) : null,
      validUntil: d.validUntil ? new Date(d.validUntil) : null,
      status: "APPROVED",
      hostStaffId: auth.user.userId,
      approvedById: auth.user.userId,
      approvedAt: now,
    },
    include: vipInclude,
  });

  return ok(toVIPDTO(pass), { status: 201 });
}

// GET /api/admin/vip — HEAD. Overwatch feed of all staff-generated guest passes.
export async function GET(req: Request) {
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");

  const whereClause: any = {};
  if (statusFilter && statusFilter !== "ALL") {
    whereClause.status = statusFilter;
  }

  const rows = await prisma.vIPPass.findMany({
    where: whereClause,
    include: vipInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return ok({ items: rows.map(toVIPDTO) });
}
