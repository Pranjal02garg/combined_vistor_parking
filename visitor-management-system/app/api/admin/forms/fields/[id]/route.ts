import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { fieldUpdateSchema } from "@/lib/validation/admin";

async function requireHead() {
  const user = await getGuard();
  if (!user) return { res: fail(401, "Not signed in") };
  if (user.role !== "HEAD") return { res: fail(403, "HEAD only") };
  return { user };
}

// PATCH /api/admin/forms/fields/:id — HEAD. Edit a form field configuration.
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

  const parsed = parseOr400(fieldUpdateSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  try {
    const existingField = await prisma.formField.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existingField) return fail(404, "Field not found");

    await prisma.$transaction(async (tx) => {
      if (d.options !== undefined) {
        // Drop existing options
        await tx.fieldOption.deleteMany({
          where: { fieldId: id },
        });
      }

      await tx.formField.update({
        where: { id },
        data: {
          label: d.label,
          type: d.type,
          required: d.required,
          placeholder: d.placeholder,
          pattern: d.pattern,
          maxLength: d.maxLength,
          sortOrder: d.sortOrder,
          requiredWhenField: d.requiredWhenField,
          requiredWhenValue: d.requiredWhenValue,
          active: d.active,
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
      });
    });

    return ok({ id, message: "Field updated successfully" });
  } catch (e) {
    throw e;
  }
}

// DELETE /api/admin/forms/fields/:id — HEAD. Soft-delete (archive) a form field.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  const { id } = await params;

  const updated = await prisma.formField.updateMany({
    where: { id },
    data: { active: false },
  });

  if (updated.count === 0) return fail(404, "Field not found");
  return ok({ id, archived: true });
}
