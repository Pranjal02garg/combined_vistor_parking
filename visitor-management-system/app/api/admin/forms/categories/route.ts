import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { categoryCreateSchema } from "@/lib/validation/admin";

// POST /api/admin/forms/categories — HEAD. Create a form category.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD") return fail(403, "HEAD only");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }
  const parsed = parseOr400(categoryCreateSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  try {
    const cat = await prisma.formCategory.create({
      data: {
        key: d.key.toUpperCase(),
        label: d.label,
        description: d.description || null,
        icon: d.icon || null,
        sortOrder: d.sortOrder ?? 0,
      },
      select: { id: true, key: true },
    });
    return ok(cat, { status: 201 });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002")
      return fail(409, "Category key already exists");
    throw e;
  }
}
