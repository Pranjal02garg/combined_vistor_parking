import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD") return fail(403, "HEAD only");

  let body: any = {};
  try { body = await req.json(); } catch {}

  const active = Boolean(body.active);
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : "";

  const existing = await prisma.systemSettings.findUnique({ where: { id: "global" } });
  const flags = ((existing?.featureFlags as any) ?? {});

  await prisma.systemSettings.upsert({
    where: { id: "global" },
    update: {
      featureFlags: {
        ...flags,
        lockdownActive: active,
        lockdownReason: active ? reason : "",
        lockdownAt: active ? new Date().toISOString() : null,
      },
    },
    create: {
      id: "global",
      overstayMinutes: 120,
      defaulterThreshold: 3,
      featureFlags: { lockdownActive: active, lockdownReason: reason, lockdownAt: active ? new Date().toISOString() : null },
    },
  });

  return ok({ lockdownActive: active });
}

export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD") return fail(403, "HEAD only");

  const settings = await prisma.systemSettings.findUnique({ where: { id: "global" } });
  const flags = (settings?.featureFlags as any) ?? {};

  return ok({
    lockdownActive: Boolean(flags.lockdownActive),
    lockdownReason: flags.lockdownReason || "",
    lockdownAt: flags.lockdownAt || null,
  });
}
