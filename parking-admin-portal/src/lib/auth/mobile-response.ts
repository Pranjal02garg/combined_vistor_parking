import type { MobileUser, UserDocument } from "@/lib/auth/types";

export function toMobileUser(user: UserDocument): MobileUser {
  return {
    id: user._id.toHexString(),
    email: user.email,
    role: user.role,
    name: user.name,
    department: user.department ?? null,
    faculty_id: user.faculty_id ?? null,
    phone: user.phone ?? null,
    alternateContact: user.alternateContact ?? null,
    allowed: Boolean(user.parkingEligible),
    isActive: Boolean(user.isActive),
  };
}

export function toMobileSession(expiresAt: Date): { expiresAt: string } {
  return {
    expiresAt: expiresAt.toISOString(),
  };
}
