import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail } from "@/lib/server/http";

// POST /api/admin/visits/:id/force-exit
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await getGuard();
  if (!guard || guard.role !== "HEAD") return fail(401, "Unauthorized");

  const { id } = await params;
  if (!id || id.length > 64) return fail(400, "Bad id");

  const visit = await prisma.visitLog.findUnique({
    where: { id },
    select: { status: true, approvedAt: true, visitorId: true },
  });
  if (!visit) return fail(404, "Not found");
  if (visit.status !== "APPROVED") {
    return fail(409, "Visit is not currently active on campus");
  }

  const exitedAt = new Date();
  const result = await prisma.visitLog.updateMany({
    where: { id, status: "APPROVED" },
    data: {
      status: "EXITED",
      exitedAt,
      exitedById: guard.userId,
    },
  });
  if (result.count === 0) return fail(409, "Visit already exited");

  return ok({ id, status: "EXITED" });
}
