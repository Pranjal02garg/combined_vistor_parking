import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const session = await getGuard();
  if (!session) return fail(401, "Not signed in");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const { name, department, phone, alternateContact } = body;

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: {
      ...(name ? { name } : {}),
      ...(department !== undefined ? { department } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(alternateContact !== undefined ? { alternateContact } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      facultyId: true,
      phone: true,
      alternateContact: true,
    },
  });

  return ok({ user: updated, message: "Profile updated successfully" });
}
