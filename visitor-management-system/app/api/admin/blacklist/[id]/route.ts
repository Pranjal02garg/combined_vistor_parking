import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { blacklistUpdateSchema } from "@/lib/validation/admin";

async function requireHead() {
  const user = await getGuard();
  if (!user) return { res: fail(401, "Not signed in") };
  if (user.role !== "HEAD") return { res: fail(403, "HEAD only") };
  return { user };
}

// PATCH /api/admin/blacklist/:id — HEAD. Update a blacklist entry.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const parsed = parseOr400(blacklistUpdateSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  const data: any = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.reason !== undefined) data.reason = d.reason;
  if (d.active !== undefined) data.active = d.active;
  if (d.expiresAt !== undefined) {
    data.expiresAt = d.expiresAt ? new Date(d.expiresAt) : null;
  }

  try {
    const updated = await prisma.blacklist.updateMany({
      where: { id },
      data,
    });
    if (updated.count === 0) return fail(404, "Blacklist entry not found");
    return ok({ id, message: "Blacklist entry updated" });
  } catch (e) {
    throw e;
  }
}

// DELETE /api/admin/blacklist/:id — HEAD. Delete a blacklist entry.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  const { id } = await params;
  const deleted = await prisma.blacklist.deleteMany({
    where: { id },
  });

  if (deleted.count === 0) return fail(404, "Blacklist entry not found");
  return ok({ id, deleted: true });
}
