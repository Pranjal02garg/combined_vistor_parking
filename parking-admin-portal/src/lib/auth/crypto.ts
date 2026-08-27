import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";

const argonOptions: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash(randomBytes(32).toString("hex"), argonOptions);
  }

  return dummyHashPromise;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, argonOptions);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function verifyAgainstDummyHash(password: string): Promise<void> {
  const dummyHash = await getDummyHash();

  try {
    await argon2.verify(dummyHash, password);
  } catch {
    // Intentionally ignored. This call only normalizes timing for unknown users.
  }
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
