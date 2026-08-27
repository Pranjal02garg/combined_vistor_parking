import { prisma } from "@/lib/server/prisma";
import { getMobileUser } from "@/lib/server/mobile-auth";
import { ok, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");

  const staffLinks = await prisma.staffHouseHelp.findMany({
    where: { staffId: user.id },
    include: {
      houseHelp: {
        include: {
          logs: {
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { gate: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({
    helps: staffLinks.map((sl) => ({
      linkId: sl.id,
      quarterNumber: sl.quarterNumber,
      validUntil: sl.validUntil,
      isActive: sl.isActive,
      workShift: sl.workShift,
      helper: {
        id: sl.houseHelp.id,
        name: sl.houseHelp.name,
        phone: sl.houseHelp.phone,
        serviceType: sl.houseHelp.serviceType,
        token: sl.houseHelp.token,
        status: sl.houseHelp.status,
        photoUrl: sl.houseHelp.photoUrl,
        recentLogs: sl.houseHelp.logs,
      },
    })),
  });
}
