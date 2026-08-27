import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

// POST /api/admin/house-helps/:id/decision — HEAD. Approve / Reject / Suspend house help
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD") return fail(403, "HEAD only");

  const { id } = await params;
  if (!id) return fail(400, "Missing id");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const action = body.action; // "approve" | "reject" | "suspend"
  let newStatus = "APPROVED";
  if (action === "reject") newStatus = "REJECTED";
  else if (action === "suspend") newStatus = "SUSPENDED";
  else if (action === "approve") newStatus = "APPROVED";
  else return fail(400, "Invalid action");

  const updated = await prisma.houseHelp.update({
    where: { id },
    data: {
      status: newStatus,
      approvedById: user.userId,
      approvedAt: new Date(),
    },
  });

  return ok({ id: updated.id, status: updated.status, message: `House help ${newStatus.toLowerCase()} successfully.` });
}
