import { randomBytes } from "crypto";
import { hash } from "@node-rs/argon2";
import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { userCreateSchema } from "@/lib/validation/users";
import { createPasswordResetToken, sendPasswordResetEmail } from "@/lib/server/passwordReset";

async function requireHead() {
  const user = await getGuard();
  if (!user) return { res: fail(401, "Not signed in") };
  if (user.role !== "HEAD") return { res: fail(403, "HEAD only") };
  return { user };
}

// GET /api/admin/users — HEAD. List all Staff + Guard accounts (HEAD accounts
// are managed outside this surface — see lib/validation/users.ts).
export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  const users = await prisma.user.findMany({
    where: { role: { in: ["STAFF", "GUARD"] } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      gates: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({ items: users });
}

// POST /api/admin/users — HEAD. Create a new Staff or Guard account. If no
// password is supplied, a random temp password is set and a "set your
// password" reset email is sent immediately instead.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const parsed = parseOr400(userCreateSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: d.email } });
  if (existing) return fail(409, "An account with this email already exists");

  const rawPassword = d.password ?? randomBytes(12).toString("base64url");
  const passwordHash = await hash(rawPassword);

  const user = await prisma.user.create({
    data: {
      email: d.email,
      name: d.name,
      role: d.role,
      passwordHash,
      ...(d.gateIds ? { gates: { connect: d.gateIds.map((id) => ({ id })) } } : {}),
    },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "USER_CREATE",
      entityType: "User",
      entityId: user.id,
      actorId: auth.user.userId,
      details: { email: user.email, role: user.role },
    },
  });

  // No password supplied → onboard via the same forgot-password flow.
  if (!d.password) {
    const token = await createPasswordResetToken(user.id);
    await sendPasswordResetEmail(user.email, user.name, token);
  }

  return ok(user, { status: 201 });
}
