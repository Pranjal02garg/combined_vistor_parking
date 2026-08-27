import { prisma } from "@/lib/server/prisma";
import { getMobileUser } from "@/lib/server/mobile-auth";
import { ok, fail } from "@/lib/server/http";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");

  const passes = await prisma.vIPPass.findMany({
    where: { hostStaffId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      entryGate: { select: { name: true, code: true } },
    },
  });

  return ok({ passes });
}

export async function POST(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");

  try {
    const { guestName, guestPhone, purpose, vehicleNumber, validFrom, validUntil } = await req.json();

    if (!guestName || !guestPhone || !purpose) {
      return fail(400, "Guest name, phone, and purpose are required");
    }

    const token = `VIP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const defaultGate = await prisma.gate.findFirst();

    const pass = await prisma.vIPPass.create({
      data: {
        token,
        guestName,
        guestPhone,
        purpose,
        vehicleNumber: vehicleNumber ? vehicleNumber.toUpperCase().trim() : null,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: user.role === "HEAD" ? "APPROVED" : "PENDING",
        hostStaffId: user.id,
        entryGateId: defaultGate?.id || null,
        approvedAt: user.role === "HEAD" ? new Date() : null,
        approvedById: user.role === "HEAD" ? user.id : null,
      },
    });

    return ok({ pass, message: "VIP Guest pass generated successfully" }, { status: 201 });
  } catch (err: any) {
    return fail(500, err?.message || "Failed to create VIP pass");
  }
}
