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

  const message = typeof body.message === "string" ? body.message.slice(0, 300) : "";
  const priority = body.priority === "urgent" ? "urgent" : "normal";
  const scheduledFor = typeof body.scheduledFor === "string" && body.scheduledFor ? body.scheduledFor : null;

  const existing = await prisma.systemSettings.findUnique({ where: { id: "global" } });
  const flags = ((existing?.featureFlags as any) ?? {});

  await prisma.systemSettings.upsert({
    where: { id: "global" },
    update: {
      featureFlags: {
        ...flags,
        broadcastMessage: message,
        broadcastPriority: priority,
        broadcastAt: message ? new Date().toISOString() : null,
        broadcastScheduledFor: scheduledFor,
      },
    },
    create: {
      id: "global",
      overstayMinutes: 120,
      defaulterThreshold: 3,
      featureFlags: { broadcastMessage: message, broadcastPriority: priority, broadcastAt: message ? new Date().toISOString() : null, broadcastScheduledFor: scheduledFor },
    },
  });

  return ok({ sent: true, message });
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD") return fail(403, "HEAD only");

  const existing = await prisma.systemSettings.findUnique({ where: { id: "global" } });
  const flags = ((existing?.featureFlags as any) ?? {});

  await prisma.systemSettings.upsert({
    where: { id: "global" },
    update: { featureFlags: { ...flags, broadcastMessage: null, broadcastAt: null, broadcastScheduledFor: null } },
    create: { id: "global", overstayMinutes: 120, defaulterThreshold: 3, featureFlags: {} },
  });

  return ok({ cleared: true });
}
