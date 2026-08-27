import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

// PATCH /api/incidents/:id — HEAD. Resolve or update an incident note
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD") return fail(403, "Only Admin can manage incident records");

  const { id } = await params;
  if (!id) return fail(400, "Missing id");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const status = body.status; // "RESOLVED" | "DISMISSED" | "FLAGGED"
  const resolution = (body.resolution || "").trim();

  const updateData: any = {};
  if (status) updateData.status = status;
  if (resolution) updateData.resolution = resolution;
  if (status === "RESOLVED" || status === "DISMISSED") {
    updateData.resolvedAt = new Date();
  }

  const updated = await prisma.incidentLog.update({
    where: { id },
    data: updateData,
  });

  return ok({ id: updated.id, status: updated.status, message: "Incident updated successfully." });
}
