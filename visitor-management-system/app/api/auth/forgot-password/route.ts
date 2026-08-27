import { prisma } from "@/lib/server/prisma";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { forgotPasswordLimiter, allow } from "@/lib/server/ratelimit";
import { createPasswordResetToken, sendPasswordResetEmail } from "@/lib/server/passwordReset";

const IS_DEV = process.env.NODE_ENV !== "production";

// POST /api/auth/forgot-password — PUBLIC. Always responds the same way
// whether or not the email exists, so this endpoint can't be used to
// enumerate registered accounts.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const parsed = parseOr400(forgotPasswordSchema, body);
  if (!parsed.ok) return parsed.res;
  const { email } = parsed.data;

  if (!(await allow(forgotPasswordLimiter, `forgot:${email}`))) {
    return fail(429, "Too many requests. Please wait before trying again.");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  let devLink: string | undefined;
  if (user && user.isActive) {
    const token = await createPasswordResetToken(user.id);
    devLink = await sendPasswordResetEmail(user.email, user.name, token);
  }

  return ok({ sent: true, ...(IS_DEV && devLink ? { devLink } : {}) });
}
