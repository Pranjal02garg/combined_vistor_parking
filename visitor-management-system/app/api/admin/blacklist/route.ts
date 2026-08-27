import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { blacklistCreateSchema } from "@/lib/validation/admin";

async function requireHeadOrGuard() {
  const user = await getGuard();
  if (!user) return { res: fail(401, "Not signed in") };
  if (user.role !== "HEAD" && user.role !== "GUARD") return { res: fail(403, "Admin only") };
  return { user };
}

// GET /api/admin/blacklist — HEAD/GUARD. List blacklist logs.
export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHeadOrGuard();
  if ("res" in auth) return auth.res;

  const list = await prisma.blacklist.findMany({
    orderBy: { createdAt: "desc" },
  });

  return ok({ items: list });
}

// POST /api/admin/blacklist — HEAD/GUARD. Add a phone number to the blacklist.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHeadOrGuard();
  if ("res" in auth) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const parsed = parseOr400(blacklistCreateSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  try {
    const entry = await prisma.blacklist.upsert({
      where: { phone: d.phone },
      update: {
        name: d.name || null,
        reason: d.reason,
        active: true,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
        createdById: auth.user.userId,
      },
      create: {
        phone: d.phone,
        name: d.name || null,
        reason: d.reason,
        active: true,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
        createdById: auth.user.userId,
      },
    });

    return ok(entry, { status: 201 });
  } catch (e) {
    throw e;
  }
}
