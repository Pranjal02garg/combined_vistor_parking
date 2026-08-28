import { prisma } from "@/lib/server/prisma";
import { getMobileUser } from "@/lib/server/mobile-auth";
import { ok, fail } from "@/lib/server/http";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");

  const staffLinks = await prisma.staffHouseHelp.findMany({
    where: { staffId: user.id },
    include: {
      houseHelp: {
        include: {
          logs: {
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { gate: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({
    helps: staffLinks.map((sl) => ({
      linkId: sl.id,
      quarterNumber: sl.quarterNumber,
      validUntil: sl.validUntil,
      isActive: sl.isActive,
      workShift: sl.workShift,
      helper: {
        id: sl.houseHelp.id,
        name: sl.houseHelp.name,
        phone: sl.houseHelp.phone,
        serviceType: sl.houseHelp.serviceType,
        token: sl.houseHelp.token,
        status: sl.houseHelp.status,
        photoUrl: sl.houseHelp.photoUrl,
        recentLogs: sl.houseHelp.logs,
      },
    })),
  });
}

export async function POST(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");

  try {
    const {
      phone,
      name,
      serviceType,
      quarterNumber,
      workShift,
      idProofType,
      idProofNumber,
      idProofDocUrl,
      photoUrl,
    } = await req.json();

    if (!phone) {
      return fail(400, "Mobile phone number is required");
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "").slice(-10);

    // 10-digit auto-linking check
    let houseHelp = await prisma.houseHelp.findUnique({
      where: { phone: cleanPhone },
    });

    if (!houseHelp) {
      const token = `HLP-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      houseHelp = await prisma.houseHelp.create({
        data: {
          token,
          name: (name || "Domestic Staff").trim(),
          phone: cleanPhone,
          serviceType: serviceType || "MAID",
          photoUrl: photoUrl || null,
          idProofType: idProofType || "AADHAAR",
          idProofNumber: idProofNumber || null,
          idProofDocUrl: idProofDocUrl || null,
          status: "APPROVED",
          registeredById: user.id,
        },
      });
    }

    // Link or update staff relation
    const existingLink = await prisma.staffHouseHelp.findUnique({
      where: {
        staffId_houseHelpId: {
          staffId: user.id,
          houseHelpId: houseHelp.id,
        },
      },
    });

    let link;
    if (existingLink) {
      link = await prisma.staffHouseHelp.update({
        where: { id: existingLink.id },
        data: {
          quarterNumber: quarterNumber || existingLink.quarterNumber,
          workShift: workShift || existingLink.workShift,
          isActive: true,
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });
    } else {
      link = await prisma.staffHouseHelp.create({
        data: {
          staffId: user.id,
          houseHelpId: houseHelp.id,
          quarterNumber: quarterNumber || "Faculty Residence",
          workShift: workShift || "General Shift",
          isActive: true,
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });
    }

    return ok(
      {
        help: {
          id: houseHelp.id,
          token: houseHelp.token,
          name: houseHelp.name,
          phone: houseHelp.phone,
          serviceType: houseHelp.serviceType,
          quarterNumber: link.quarterNumber,
          workShift: link.workShift,
          status: houseHelp.status,
          isActive: link.isActive,
          photoUrl: houseHelp.photoUrl,
        },
        message: "Staff member linked successfully",
      },
      { status: 201 }
    );
  } catch (err: any) {
    return fail(500, err?.message || "Failed to register staff");
  }
}
