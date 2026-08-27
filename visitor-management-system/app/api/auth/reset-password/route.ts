import { hash } from "@node-rs/argon2";
import { prisma } from "@/lib/server/prisma";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { consumePasswordResetToken } from "@/lib/server/passwordReset";

// POST /api/auth/reset-password — PUBLIC (the token itself is the credential).
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const parsed = parseOr400(resetPasswordSchema, body);
  if (!parsed.ok) return parsed.res;
  const { token, password } = parsed.data;

  const userId = await consumePasswordResetToken(token);
  if (!userId) return fail(400, "This reset link is invalid or has expired.");

  const passwordHash = await hash(password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return ok({ success: true });
}
