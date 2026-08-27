import { randomBytes, createHash } from "crypto";
import { prisma } from "./prisma";
import { sendEmail } from "./email";

const TOKEN_TTL_MS = 30 * 60 * 1000; // reset link valid for 30 minutes
const IS_DEV = process.env.NODE_ENV !== "production";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("base64url");
}

/**
 * Issues a single-use reset token for a user. Only the SHA-256 hash is
 * persisted — the raw token (embedded in the emailed link) is never stored,
 * so a DB leak alone can't be replayed as a live reset link. Any of the
 * user's previously-issued, still-unused tokens are invalidated first.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return raw;
}

/** Validates + burns a reset token. Returns the userId, or null if invalid/expired/used. */
export async function consumePasswordResetToken(raw: string): Promise<string | null> {
  const tokenHash = hashToken(raw);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return record.userId;
}

/**
 * Sends (or, in dev without real infra, logs) the reset link for a raw token.
 * Returns the link in dev so a route can surface it for local testing without
 * requiring SES credentials — mirrors the dev fallback in lib/server/otp.ts.
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  rawToken: string
): Promise<string | undefined> {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  const link = `${base}/reset-password?token=${rawToken}`;

  if (IS_DEV) {
    console.log(`[dev] Password reset link for ${email}: ${link}`);
    return link;
  }

  await sendEmail(
    email,
    "Reset your Campus Gate Pass password",
    `<p>Hi ${name},</p>
     <p>Click the link below to set a new password. This link expires in 30 minutes and can only be used once.</p>
     <p><a href="${link}">${link}</a></p>
     <p>If you didn't request this, you can safely ignore this email.</p>`
  );
  return undefined;
}
