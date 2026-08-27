import { prisma } from "@/lib/server/prisma";
import { createMobileToken } from "@/lib/server/mobile-auth";
import { verify } from "@node-rs/argon2";
import { ok, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return fail(400, "Email and password are required");
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        vehicles: { where: { isActive: true } },
      },
    });

    if (!user || !user.isActive) {
      return fail(401, "Invalid email or account disabled");
    }

    const valid = await verify(user.passwordHash, password);
    if (!valid) {
      return fail(401, "Invalid password");
    }

    const token = createMobileToken(user.id);

    return ok({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department || "Faculty",
        facultyId: user.facultyId || "FAC-001",
        phone: user.phone || null,
        parkingEligible: user.parkingEligible,
        eligibleFrom: user.eligibleFrom?.toISOString() || null,
        eligibleTill: user.eligibleTill?.toISOString() || null,
        allowedCars: user.vehicles.map((v) => ({
          id: v.id,
          plateNumber: v.plateNumber,
          stickerColor: v.stickerColor,
          vehicleType: v.vehicleType,
          modelName: v.modelName,
        })),
      },
    });
  } catch (err: any) {
    return fail(500, err?.message || "Login failed");
  }
}
