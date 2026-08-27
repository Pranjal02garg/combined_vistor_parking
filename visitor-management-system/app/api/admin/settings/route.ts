import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { settingsUpdateSchema } from "@/lib/validation/admin";
import { getSettings } from "@/lib/server/settings";

async function requireHead() {
  const user = await getGuard();
  if (!user) return { res: fail(401, "Not signed in") };
  if (user.role !== "HEAD") return { res: fail(403, "HEAD only") };
  return { user };
}

// GET /api/admin/settings — HEAD. Read global system settings.
export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  const settings = await getSettings();
  return ok(settings);
}

// PATCH /api/admin/settings — HEAD. Update system settings.
export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const parsed = parseOr400(settingsUpdateSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  const settings = await prisma.systemSettings.upsert({
    where: { id: "global" },
    update: {
      overstayMinutes: d.overstayMinutes,
      defaulterThreshold: d.defaulterThreshold,
      featureFlags: d.featureFlags,
      updatedById: auth.user.userId,
    },
    create: {
      id: "global",
      overstayMinutes: d.overstayMinutes ?? 120,
      defaulterThreshold: d.defaulterThreshold ?? 3,
      featureFlags: d.featureFlags ?? {},
      updatedById: auth.user.userId,
    },
  });

  return ok(settings);
}
