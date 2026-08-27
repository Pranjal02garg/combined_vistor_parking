import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD") return fail(403, "HEAD only");

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return ok({ visits: [], vips: [] });

  const [visits, vips] = await Promise.all([
    prisma.visitLog.findMany({
      where: {
        OR: [
          { visitor: { name: { contains: q } } },
          { visitor: { phone: { contains: q } } },
          { vehicleNumber: { contains: q } },
          { referenceCode: { contains: q } },
        ],
      },
      include: { visitor: { select: { name: true, phone: true } }, entryGate: { select: { name: true, code: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.vIPPass.findMany({
      where: {
        OR: [
          { guestName: { contains: q } },
          { guestPhone: { contains: q } },
          { vehicleNumber: { contains: q } },
          { token: { contains: q } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return ok({
    visits: visits.map((v) => ({
      id: v.id,
      referenceCode: v.referenceCode,
      name: v.visitor.name,
      phone: v.visitor.phone,
      vehicleNumber: v.vehicleNumber,
      status: v.status,
      category: v.categoryLabel ?? v.category,
      gate: v.entryGate.name,
      createdAt: v.createdAt.toISOString(),
    })),
    vips: vips.map((p) => ({
      id: p.id,
      token: p.token,
      name: p.guestName,
      phone: p.guestPhone,
      purpose: p.purpose,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
