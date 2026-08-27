import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { fieldCreateSchema } from "@/lib/validation/admin";

// POST /api/admin/forms/fields — HEAD. Create a new form field configuration.
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

  const parsed = parseOr400(fieldCreateSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  try {
    const categoryExists = await prisma.formCategory.count({
      where: { id: d.categoryId },
    });
    if (categoryExists === 0) return fail(404, "Category not found");

    const field = await prisma.formField.create({
      data: {
        categoryId: d.categoryId,
        name: d.name,
        label: d.label,
        type: d.type,
        required: d.required ?? true,
        placeholder: d.placeholder,
        pattern: d.pattern,
        maxLength: d.maxLength,
        sortOrder: d.sortOrder ?? 0,
        requiredWhenField: d.requiredWhenField,
        requiredWhenValue: d.requiredWhenValue,
        options: d.options
          ? {
              create: d.options.map((opt, index) => ({
                value: opt.value,
                label: opt.label,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      select: { id: true, name: true },
    });

    return ok(field, { status: 201 });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      return fail(409, "Field name already exists in this category");
    }
    throw e;
  }
}
