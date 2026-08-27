import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { userUpdateSchema } from "@/lib/validation/users";

async function requireHead() {
  const user = await getGuard();
  if (!user) return { res: fail(401, "Not signed in") };
  if (user.role !== "HEAD") return { res: fail(403, "HEAD only") };
  return { user };
}

// PATCH /api/admin/users/:id — HEAD. Update a Staff/Guard account (name,
// role, active state, gate assignments). HEAD accounts aren't manageable
// here, and HEAD can't act on their own account (no self-lockout).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  const { id } = await params;
  if (id === auth.user.userId) return fail(400, "You cannot modify your own account here");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const parsed = parseOr400(userUpdateSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target || target.role === "HEAD") return fail(404, "Account not found");

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.role !== undefined ? { role: d.role } : {}),
      ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      ...(d.gateIds !== undefined ? { gates: { set: d.gateIds.map((gid) => ({ id: gid })) } } : {}),
    },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "USER_UPDATE",
      entityType: "User",
      entityId: id,
      actorId: auth.user.userId,
      details: d,
    },
  });

  return ok(updated);
}

// DELETE /api/admin/users/:id — HEAD. Soft-delete (deactivate) an account.
// Hard-deleting would violate FK constraints from VisitLog/VIPPass/AuditLog
// history, so this revokes login by setting isActive:false instead — the
// same soft-delete convention already used for FormCategory/FormField.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  const { id } = await params;
  if (id === auth.user.userId) return fail(400, "You cannot deactivate your own account");

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target || target.role === "HEAD") return fail(404, "Account not found");

  await prisma.user.update({ where: { id }, data: { isActive: false } });

  await prisma.auditLog.create({
    data: {
      action: "USER_DEACTIVATE",
      entityType: "User",
      entityId: id,
      actorId: auth.user.userId,
    },
  });

  return ok({ id, deactivated: true });
}
