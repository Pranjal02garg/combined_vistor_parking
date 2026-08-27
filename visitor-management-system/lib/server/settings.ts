import { prisma } from "@/lib/server/prisma";

/**
 * Returns the SystemSettings configuration.
 * Automatically upserts default values if the global configuration is missing.
 */
export async function getSettings() {
  return await prisma.systemSettings.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      overstayMinutes: 120,
      defaulterThreshold: 3,
    },
  });
}
