import { prisma } from "@/lib/server/prisma";
import { getMobileUser } from "@/lib/server/mobile-auth";
import { ok, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// SEC-4: pause/activate a helper or extend their validity — persisted, and
// scoped to the caller's OWN staff↔helper link so one faculty can't touch
// another's arrangement. `id` is the HouseHelp id.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");
  const { id } = await params;

  let body: { isActive?: boolean; validUntil?: string } = {};
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid request body");
  }

  const link = await prisma.staffHouseHelp.findUnique({
    where: { staffId_houseHelpId: { staffId: user.id, houseHelpId: id } },
  });
  if (!link) return fail(404, "Helper is not linked to your quarter");

  const data: { isActive?: boolean; validUntil?: Date } = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.validUntil) {
    const d = new Date(body.validUntil);
    if (isNaN(d.getTime())) return fail(400, "Invalid validUntil date");
    data.validUntil = d;
  }
  if (Object.keys(data).length === 0) return fail(400, "Nothing to update");

  const updated = await prisma.staffHouseHelp.update({
    where: { id: link.id },
    data,
  });

  return ok({ ok: true, isActive: updated.isActive, validUntil: updated.validUntil });
}

// SEC-4: unlink a helper from the caller's quarter (removes only THIS staff's
// link; the helper's other employers are untouched).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");
  const { id } = await params;

  const link = await prisma.staffHouseHelp.findUnique({
    where: { staffId_houseHelpId: { staffId: user.id, houseHelpId: id } },
  });
  if (!link) return fail(404, "Helper is not linked to your quarter");

  await prisma.staffHouseHelp.delete({ where: { id: link.id } });
  return ok({ ok: true, unlinked: id });
}
