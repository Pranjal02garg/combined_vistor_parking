import { cookies } from "next/headers";
import { Db, ObjectId } from "mongodb";

import {
  ACCOUNT_LOCK_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "@/lib/auth/constants";
import { generateSessionToken, hashSessionToken } from "@/lib/auth/crypto";
import type {
  AuthResult,
  PublicUser,
  SessionDocument,
  UserDocument,
} from "@/lib/auth/types";
import { getDb } from "@/lib/mongodb";

const USERS_COLLECTION = "users";
const SESSIONS_COLLECTION = "sessions";

let indexInitializationPromise: Promise<void> | null = null;

type SessionLookupOptions = {
  onSessionRefreshed?: (token: string, expiresAt: Date) => Promise<void>;
};

export type UserProfileUpdates = {
  name?: string;
  department?: string | null;
  phone?: string | null;
  alternateContact?: string | null;
};

function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    parkingEligible: user.parkingEligible,
    eligibleFrom: user.eligibleFrom ? user.eligibleFrom.toISOString() : null,
    eligibleTill: user.eligibleTill ? user.eligibleTill.toISOString() : null,
    allowedCars: user.allowedCars ?? [],
    createdAt: user.createdAt.toISOString(),
  };
}

async function ensureIndexes(db: Db): Promise<void> {
  if (!indexInitializationPromise) {
    indexInitializationPromise = Promise.all([
      db
        .collection<UserDocument>(USERS_COLLECTION)
        .createIndex({ email: 1 }, { unique: true, name: "email_unique" }),
      db
        .collection<SessionDocument>(SESSIONS_COLLECTION)
        .createIndex({ tokenHash: 1 }, { unique: true, name: "tokenHash_unique" }),
      db
        .collection<SessionDocument>(SESSIONS_COLLECTION)
        .createIndex({ userId: 1 }, { name: "userId_1" }),
      db
        .collection<SessionDocument>(SESSIONS_COLLECTION)
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "sessions_ttl" }),
    ]).then(() => undefined);
  }

  await indexInitializationPromise;
}

async function getCollections() {
  const db = await getDb();
  await ensureIndexes(db);

  return {
    users: db.collection<UserDocument>(USERS_COLLECTION),
    sessions: db.collection<SessionDocument>(SESSIONS_COLLECTION),
  };
}

function getCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function findUserByEmail(
  email: string,
): Promise<UserDocument | null> {
  const { users } = await getCollections();
  return users.findOne({ email });
}

export async function createUser(
  name: string,
  email: string,
  passwordHash: string,
  role: "admin" | "user" = "user",
  options?: {
    parkingEligible?: boolean;
    eligibleFrom?: Date | null;
    eligibleTill?: Date | null;
    allowedCars?: {
      plateNumber: string;
      stickerColor: "green" | "red" | "blue";
    }[];
  },
): Promise<PublicUser> {
  const { users } = await getCollections();
  const now = new Date();
  const insertedId = new ObjectId();

  const userDoc = {
    _id: insertedId,
    name,
    department: null,
    faculty_id: null,
    phone: null,
    alternateContact: null,
    email,
    passwordHash,
    role,
    isActive: true,
    parkingEligible: options?.parkingEligible ?? false,
    eligibleFrom: options?.eligibleFrom ?? null,
    eligibleTill: options?.eligibleTill ?? null,
    allowedCars: options?.allowedCars ?? [],
    failedLoginAttempts: 0,
    lockUntil: null,
    createdAt: now,
    updatedAt: now,
  };

  await users.insertOne(userDoc);

  return toPublicUser(userDoc);
}

export async function recordFailedLoginAttempt(
  user: UserDocument,
): Promise<void> {
  const { users } = await getCollections();
  const nextFailedAttempts = user.failedLoginAttempts + 1;
  const shouldLock = nextFailedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        failedLoginAttempts: shouldLock ? 0 : nextFailedAttempts,
        lockUntil: shouldLock ? new Date(Date.now() + ACCOUNT_LOCK_MS) : null,
        updatedAt: new Date(),
      },
    },
  );
}

export async function clearFailedLoginState(userId: ObjectId): Promise<void> {
  const { users } = await getCollections();

  await users.updateOne(
    { _id: userId },
    {
      $set: {
        failedLoginAttempts: 0,
        lockUntil: null,
        updatedAt: new Date(),
      },
    },
  );
}

export function isUserLocked(user: UserDocument): boolean {
  return Boolean(user.lockUntil && user.lockUntil.getTime() > Date.now());
}

export function getSecondsUntilUnlocked(user: UserDocument): number {
  if (!user.lockUntil) {
    return 0;
  }

  return Math.max(0, Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000));
}

export async function createSession(
  userId: ObjectId,
  metadata: {
    ipAddress: string | null;
    userAgent: string | null;
  },
): Promise<{ token: string; expiresAt: Date }> {
  const { sessions } = await getCollections();
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await sessions.insertOne({
    _id: new ObjectId(),
    userId,
    tokenHash,
    createdAt: now,
    expiresAt,
    lastSeenAt: now,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  return { token, expiresAt };
}

export async function invalidateSession(
  token: string | undefined,
): Promise<void> {
  if (!token) {
    return;
  }

  const { sessions } = await getCollections();
  await sessions.deleteOne({ tokenHash: hashSessionToken(token) });
}

export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getCookieOptions(expiresAt));
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getCookieOptions(new Date(0)),
    maxAge: 0,
  });
}

export async function getSessionTokenFromCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function getSessionWithUserFromToken(
  token: string | undefined,
  options?: SessionLookupOptions,
): Promise<{ user: UserDocument; session: SessionDocument } | null> {
  if (!token) {
    return null;
  }

  const { sessions, users } = await getCollections();
  const tokenHash = hashSessionToken(token);
  const session = await sessions.findOne({ tokenHash });
  if (!session) {
    return null;
  }

  const now = new Date();
  if (session.expiresAt.getTime() <= now.getTime()) {
    await sessions.deleteOne({ _id: session._id });
    return null;
  }

  const user = await users.findOne({ _id: session.userId });
  if (!user) {
    await sessions.deleteOne({ _id: session._id });
    return null;
  }

  if (!user.isActive) {
    await sessions.deleteOne({ _id: session._id });
    return null;
  }

  let resolvedSession = session;
  const shouldRefresh =
    session.expiresAt.getTime() - now.getTime() < SESSION_TTL_MS / 2;

  if (shouldRefresh) {
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await sessions.updateOne(
      { _id: session._id },
      { $set: { expiresAt, lastSeenAt: now } },
    );

    resolvedSession = {
      ...session,
      expiresAt,
      lastSeenAt: now,
    };

    if (options?.onSessionRefreshed) {
      await options.onSessionRefreshed(token, expiresAt);
    }
  }

  return {
    user,
    session: resolvedSession,
  };
}

export async function getAuthFromToken(
  token: string | undefined,
  options?: { refreshCookie?: boolean },
): Promise<AuthResult | null> {
  const auth = await getSessionWithUserFromToken(
    token,
    options?.refreshCookie
      ? {
          onSessionRefreshed: async (rawToken, expiresAt) => {
            await setSessionCookie(rawToken, expiresAt);
          },
        }
      : undefined,
  );

  if (!auth) {
    return null;
  }

  return {
    user: toPublicUser(auth.user),
    session: {
      id: auth.session._id.toHexString(),
      expiresAt: auth.session.expiresAt.toISOString(),
    },
  };
}

export async function getCurrentAuth(): Promise<AuthResult | null> {
  const token = await getSessionTokenFromCookie();
  return getAuthFromToken(token, { refreshCookie: false });
}

export async function invalidateOtherSessions(
  userId: ObjectId,
  keepSessionId: ObjectId,
): Promise<void> {
  const { sessions } = await getCollections();
  await sessions.deleteMany({
    userId,
    _id: { $ne: keepSessionId },
  });
}

export async function updateUserPassword(
  userId: ObjectId,
  passwordHash: string,
): Promise<void> {
  const { users } = await getCollections();
  await users.updateOne(
    { _id: userId },
    {
      $set: {
        passwordHash,
        updatedAt: new Date(),
      },
    },
  );
}

export async function updateUserProfile(
  userId: ObjectId,
  updates: UserProfileUpdates,
): Promise<UserDocument | null> {
  const { users } = await getCollections();
  const profileSet: Record<string, string | null | Date> = {
    updatedAt: new Date(),
  };

  if (updates.name !== undefined) {
    profileSet.name = updates.name;
  }

  if (updates.department !== undefined) {
    profileSet.department = updates.department;
  }

  if (updates.phone !== undefined) {
    profileSet.phone = updates.phone;
  }

  if (updates.alternateContact !== undefined) {
    profileSet.alternateContact = updates.alternateContact;
  }

  await users.updateOne(
    { _id: userId },
    {
      $set: profileSet,
    },
  );

  return users.findOne({ _id: userId });
}
