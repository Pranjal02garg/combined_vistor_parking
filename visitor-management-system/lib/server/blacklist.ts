import { prisma } from "@/lib/server/prisma";

/**
 * Returns a Set of phone numbers that are currently actively blacklisted.
 * A blacklist entry is active if active === true and either has no expiry,
 * or the expiry date is in the future.
 */
export async function getActiveBlacklistPhones(phones: string[]): Promise<Set<string>> {
  if (!phones.length) return new Set();

  const now = new Date();
  const rows = await prisma.blacklist.findMany({
    where: {
      phone: { in: phones },
      active: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    select: { phone: true },
  });

  return new Set(rows.map((r) => r.phone));
}

/**
 * Checks if a specific phone number is actively blacklisted.
 */
export async function isPhoneBlacklisted(phone: string): Promise<boolean> {
  const now = new Date();
  const count = await prisma.blacklist.count({
    where: {
      phone,
      active: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
  });

  return count > 0;
}
