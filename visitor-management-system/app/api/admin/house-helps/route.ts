import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail } from "@/lib/server/http";

// GET /api/admin/house-helps — HEAD. Fetch all campus house helps with clearance & employer details
export async function GET(req: Request) {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD") return fail(403, "HEAD only");

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");

  const whereClause: any = {};
  if (statusFilter && statusFilter !== "ALL") {
    whereClause.status = statusFilter;
  }

  const helps = await prisma.houseHelp.findMany({
    where: whereClause,
    include: {
      registeredBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true } },
      staffLinks: {
        include: {
          staff: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const items = helps.map((h) => ({
    id: h.id,
    token: h.token,
    name: h.name,
    phone: h.phone,
    idProofType: h.idProofType,
    idProofNumber: h.idProofNumber,
    idProofDocUrl: h.idProofDocUrl,
    photoUrl: h.photoUrl,
    serviceType: h.serviceType,
    status: h.status,
    registeredByName: h.registeredBy?.name,
    approvedByName: h.approvedBy?.name,
    employers: h.staffLinks.map((l) => ({
      staffName: l.staff.name,
      quarterNumber: l.quarterNumber,
      validUntil: l.validUntil.toISOString(),
      isActive: l.isActive,
    })),
    createdAt: h.createdAt.toISOString(),
  }));

  return ok({ items });
}
