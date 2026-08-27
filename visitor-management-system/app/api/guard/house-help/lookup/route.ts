import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail } from "@/lib/server/http";

// GET /api/guard/house-help/lookup?token=HLP-... — GUARD/HEAD. Verify house help QR at gate
export async function GET(req: Request) {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "GUARD" && user.role !== "HEAD") return fail(403, "Forbidden");

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim().toUpperCase();
  if (!token) return fail(400, "Token is required");

  const help = await prisma.houseHelp.findUnique({
    where: { token },
    include: {
      registeredBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      staffLinks: {
        include: {
          staff: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!help) {
    return fail(404, "House help QR pass not found");
  }

  const now = new Date();

  // Check overall clearance
  if (help.status !== "APPROVED") {
    return ok({
      item: {
        id: help.id,
        token: help.token,
        name: help.name,
        phone: help.phone,
        serviceType: help.serviceType,
        status: help.status,
        photoUrl: help.photoUrl,
        employers: help.staffLinks.map((l) => ({
          staffName: l.staff.name,
          quarterNumber: l.quarterNumber,
          validUntil: l.validUntil.toISOString(),
          isActive: l.isActive,
        })),
        createdAt: help.createdAt.toISOString(),
      },
      isValid: false,
      reason: `House Help pass status is ${help.status}. Entry not permitted.`,
    });
  }

  // Check if at least one active valid employer quarter exists
  const validEmployers = help.staffLinks.filter(
    (l) => l.isActive && l.validUntil >= now
  );

  const isValid = validEmployers.length > 0;
  let reason = undefined;
  if (!isValid) {
    reason = "Pass expired or paused by staff. Please ask resident staff to extend validity.";
  }

  return ok({
    item: {
      id: help.id,
      token: help.token,
      name: help.name,
      phone: help.phone,
      serviceType: help.serviceType,
      status: help.status,
      photoUrl: help.photoUrl,
      idProofType: help.idProofType,
      idProofNumber: help.idProofNumber,
      employers: help.staffLinks.map((l) => ({
        staffName: l.staff.name,
        quarterNumber: l.quarterNumber,
        validUntil: l.validUntil.toISOString(),
        isActive: l.isActive,
      })),
      createdAt: help.createdAt.toISOString(),
    },
    isValid,
    reason,
  });
}
