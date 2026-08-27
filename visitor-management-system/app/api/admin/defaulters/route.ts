import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";
import { getSettings } from "@/lib/server/settings";

async function requireHead() {
  const user = await getGuard();
  if (!user) return { res: fail(401, "Not signed in") };
  if (user.role !== "HEAD") return { res: fail(403, "HEAD only") };
  return { user };
}

// GET /api/admin/defaulters — HEAD. Repeat overstay defaulters feed.
export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  const settings = await getSettings();
  const now = new Date();

  // Find active blacklisted phones to exclude
  const activeBlacklist = await prisma.blacklist.findMany({
    where: {
      active: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    select: { phone: true },
  });
  const blacklistedPhones = new Set(activeBlacklist.map((b) => b.phone));

  // Find visitors who overstayed at least defaulterThreshold times
  const repeatDefaulters = await prisma.visitor.findMany({
    where: {
      overstayCount: { gte: settings.defaulterThreshold },
    },
    orderBy: { overstayCount: "desc" },
    take: 100,
  });

  // Filter out currently blacklisted users
  const filtered = repeatDefaulters.filter((v) => !blacklistedPhones.has(v.phone));

  return ok({ items: filtered });
}
