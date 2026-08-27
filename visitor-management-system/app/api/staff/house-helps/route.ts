import { randomBytes } from "crypto";
import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

function newHouseHelpToken(): string {
  return `HLP-${randomBytes(6).toString("hex").toUpperCase()}`;
}

// GET /api/staff/house-helps — STAFF. Fetch house helps linked to current staff member
export async function GET() {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "STAFF" && user.role !== "HEAD") return fail(403, "Staff only");

  const links = await prisma.staffHouseHelp.findMany({
    where: { staffId: user.userId },
    include: {
      houseHelp: {
        include: {
          registeredBy: { select: { name: true } },
          approvedBy: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const items = links.map((l) => ({
    id: l.houseHelp.id,
    token: l.houseHelp.token,
    name: l.houseHelp.name,
    phone: l.houseHelp.phone,
    idProofType: l.houseHelp.idProofType,
    idProofNumber: l.houseHelp.idProofNumber,
    idProofDocUrl: l.houseHelp.idProofDocUrl,
    photoUrl: l.houseHelp.photoUrl,
    serviceType: l.houseHelp.serviceType,
    status: l.houseHelp.status,
    quarterNumber: l.quarterNumber,
    validUntil: l.validUntil.toISOString(),
    isActive: l.isActive,
    workShift: l.workShift,
    registeredByName: l.houseHelp.registeredBy?.name,
    approvedByName: l.houseHelp.approvedBy?.name,
    createdAt: l.createdAt.toISOString(),
  }));

  return ok({ items });
}

// POST /api/staff/house-helps — STAFF. Register or link a house help
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "STAFF" && user.role !== "HEAD") return fail(403, "Staff only");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const phone = (body.phone || "").replace(/\D/g, "").slice(-10);
  if (!phone || phone.length !== 10) {
    return fail(400, "Valid 10-digit phone number is required");
  }

  const quarterNumber = (body.quarterNumber || "").trim();
  if (!quarterNumber) {
    return fail(400, "Quarter/Residence number is required");
  }

  const validUntil = body.validUntil ? new Date(body.validUntil) : new Date(Date.now() + 180 * 24 * 60 * 60000); // default 6 months

  // 1. Check if house help is already registered in the campus registry
  let houseHelp = await prisma.houseHelp.findUnique({
    where: { phone },
  });

  if (houseHelp) {
    // Already registered on campus! Link directly to this staff member's quarter.
    const link = await prisma.staffHouseHelp.upsert({
      where: {
        staffId_houseHelpId: {
          staffId: user.userId,
          houseHelpId: houseHelp.id,
        },
      },
      update: {
        quarterNumber,
        validUntil,
        isActive: true,
        workShift: body.workShift || "Regular Shift",
      },
      create: {
        staffId: user.userId,
        houseHelpId: houseHelp.id,
        quarterNumber,
        validUntil,
        isActive: true,
        workShift: body.workShift || "Regular Shift",
      },
    });

    return ok(
      {
        id: houseHelp.id,
        token: houseHelp.token,
        name: houseHelp.name,
        phone: houseHelp.phone,
        serviceType: houseHelp.serviceType,
        status: houseHelp.status,
        quarterNumber: link.quarterNumber,
        validUntil: link.validUntil.toISOString(),
        isActive: link.isActive,
        reused: true,
        message: "House help already registered on campus. Linked to your quarter successfully.",
      },
      { status: 200 }
    );
  }

  // 2. New House Help registration -> requires Head clearance
  const name = (body.name || "").trim();
  if (!name) return fail(400, "Name is required for new registration");

  const serviceType = body.serviceType || "MAID";
  const photoUrl = body.photoUrl || null;
  const idProofType = body.idProofType || "AADHAAR";
  const idProofNumber = body.idProofNumber || null;
  const idProofDocUrl = body.idProofDocUrl || null;

  houseHelp = await prisma.houseHelp.create({
    data: {
      token: newHouseHelpToken(),
      name,
      phone,
      serviceType,
      photoUrl,
      idProofType,
      idProofNumber,
      idProofDocUrl,
      status: "PENDING_APPROVAL",
      registeredById: user.userId,
    },
  });

  const link = await prisma.staffHouseHelp.create({
    data: {
      staffId: user.userId,
      houseHelpId: houseHelp.id,
      quarterNumber,
      validUntil,
      isActive: true,
      workShift: body.workShift || "Regular Shift",
    },
  });

  return ok(
    {
      id: houseHelp.id,
      token: houseHelp.token,
      name: houseHelp.name,
      phone: houseHelp.phone,
      serviceType: houseHelp.serviceType,
      status: houseHelp.status,
      quarterNumber: link.quarterNumber,
      validUntil: link.validUntil.toISOString(),
      isActive: link.isActive,
      reused: false,
      message: "Registration submitted for Head Admin clearance.",
    },
    { status: 201 }
  );
}
