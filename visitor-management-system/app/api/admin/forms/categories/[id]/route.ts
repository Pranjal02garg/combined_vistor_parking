import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { categoryUpdateSchema } from "@/lib/validation/admin";

async function requireHead() {
  const user = await getGuard();
  if (!user) return { res: fail(401, "Not signed in") };
  if (user.role !== "HEAD") return { res: fail(403, "HEAD only") };
  return { user };
}

// PATCH /api/admin/forms/categories/:id — HEAD. Edit / archive a category.
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
  const parsed = parseOr400(categoryUpdateSchema, body);
  if (!parsed.ok) return parsed.res;

  const updated = await prisma.formCategory.updateMany({
    where: { id },
    data: parsed.data,
  });
  if (updated.count === 0) return fail(404, "Not found");
  return ok({ id, ...parsed.data });
}

// DELETE — soft-delete (archive), preserving history.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  const { id } = await params;
  const updated = await prisma.formCategory.updateMany({
    where: { id },
    data: { active: false },
  });
  if (updated.count === 0) return fail(404, "Not found");
  return ok({ id, archived: true });
}
