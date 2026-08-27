import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { vipEditSchema } from "@/lib/validation/admin";

async function requireGuardOrHead() {
  const user = await getGuard();
  if (!user) return { res: fail(401, "Not signed in") };
  if (user.role !== "HEAD" && user.role !== "GUARD") return { res: fail(403, "Forbidden") };
  return { user };
}

// PATCH /api/vip/:id — HEAD/GUARD. Edit any VIP pass record.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireGuardOrHead();
  if ("res" in auth) return auth.res;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const parsed = parseOr400(vipEditSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  if (d.guestName !== undefined || d.guestPhone !== undefined) {
    if (auth.user.role === "GUARD") {
      return fail(403, "Guards cannot edit name or phone number");
    }
  }

  const data: any = {};
  if (d.guestName !== undefined) data.guestName = d.guestName;
  if (d.guestPhone !== undefined) data.guestPhone = d.guestPhone;
  if (d.purpose !== undefined) data.purpose = d.purpose;
  if (d.status !== undefined) data.status = d.status;
  if (d.vehicleNumber !== undefined) {
    data.vehicleNumber = d.vehicleNumber ? d.vehicleNumber.toUpperCase() : null;
  }
  if (d.validFrom !== undefined) {
    data.validFrom = d.validFrom ? new Date(d.validFrom) : null;
  }
  if (d.validUntil !== undefined) {
    data.validUntil = d.validUntil ? new Date(d.validUntil) : null;
  }

  // Stamp audit trail
  data.editedById = auth.user.userId;
  data.editedAt = new Date();

  try {
    const updated = await prisma.vIPPass.updateMany({
      where: { id },
      data,
    });
    if (updated.count === 0) return fail(404, "VIP pass not found");
    return ok({ id, message: "VIP pass updated successfully" });
  } catch (e) {
    throw e;
  }
}
