import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

// PATCH /api/staff/house-helps/:id — STAFF. Update validity / active state for staff's house help
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "STAFF" && user.role !== "HEAD") return fail(403, "Staff only");

  const { id: houseHelpId } = await params;
  if (!houseHelpId) return fail(400, "Missing id");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const updateData: any = {};
  if (body.validUntil) updateData.validUntil = new Date(body.validUntil);
  if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;
  if (body.quarterNumber) updateData.quarterNumber = body.quarterNumber.trim();
  if (body.workShift) updateData.workShift = body.workShift.trim();

  const updated = await prisma.staffHouseHelp.updateMany({
    where: {
      staffId: user.userId,
      houseHelpId,
    },
    data: updateData,
  });

  if (updated.count === 0) {
    return fail(404, "House help record not found for your quarter");
  }

  return ok({ success: true, message: "House help settings updated successfully" });
}

// DELETE /api/staff/house-helps/:id — STAFF. Unlink house help from staff quarter
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "STAFF" && user.role !== "HEAD") return fail(403, "Staff only");

  const { id: houseHelpId } = await params;
  if (!houseHelpId) return fail(400, "Missing id");

  await prisma.staffHouseHelp.deleteMany({
    where: {
      staffId: user.userId,
      houseHelpId,
    },
  });

  return ok({ success: true, message: "House help unlinked from your quarter" });
}
