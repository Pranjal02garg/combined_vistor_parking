import { ObjectId } from "mongodb";

import type { AllowedCar, UserDocument } from "@/lib/auth/types";
import { getDb } from "@/lib/mongodb";

const QR_SESSIONS_COLLECTION = "mobileQrSessions";
const DEFAULT_QR_SESSION_TTL_SECONDS = 120;
const MIN_QR_SESSION_TTL_SECONDS = 30;
const MAX_QR_SESSION_TTL_SECONDS = 600;
const QR_SESSION_PREFIX =
  process.env.MOBILE_QR_SESSION_PREFIX ?? "PARKING_USER_SESSION:";

type QrSessionStatus = "pending" | "scanned";

type QrSessionErrorReason =
  | "INVALID_SESSION"
  | "NOT_FOUND"
  | "EXPIRED"
  | "ALREADY_SCANNED";

export type QrSessionState = "pending" | "scanned" | "expired";

export type QrSessionUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  department: string | null;
  facultyId: string | null;
  phone: string | null;
  alternateContact: string | null;
  parkingEligible: boolean;
  isActive: boolean;
  allowedCars: AllowedCar[];
};

type QrSessionDocument = {
  _id: ObjectId;
  status: QrSessionStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  scannedAt: Date | null;
  scannedBy: QrSessionUser | null;
};

export type QrSessionView = {
  sessionId: string;
  status: QrSessionState;
  createdAt: string;
  expiresAt: string;
  scannedAt: string | null;
  user: QrSessionUser | null;
};

export type QrSessionLookup =
  | { ok: true; session: QrSessionView }
  | { ok: false; reason: "INVALID_SESSION" | "NOT_FOUND" };

export type QrSessionScanResult =
  | { ok: true; session: QrSessionView }
  | { ok: false; reason: QrSessionErrorReason };

let indexInitializationPromise: Promise<void> | null = null;

async function ensureIndexes(): Promise<void> {
  if (!indexInitializationPromise) {
    indexInitializationPromise = (async () => {
      const db = await getDb();
      const collection = db.collection<QrSessionDocument>(QR_SESSIONS_COLLECTION);

      await Promise.all([
        collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        collection.createIndex({ status: 1, expiresAt: 1 }),
      ]);
    })();
  }

  await indexInitializationPromise;
}

async function getCollection() {
  const db = await getDb();
  await ensureIndexes();

  return db.collection<QrSessionDocument>(QR_SESSIONS_COLLECTION);
}

function normalizeTtlSeconds(ttlSeconds: number | undefined): number {
  if (ttlSeconds === undefined) {
    return DEFAULT_QR_SESSION_TTL_SECONDS;
  }

  if (!Number.isFinite(ttlSeconds)) {
    return DEFAULT_QR_SESSION_TTL_SECONDS;
  }

  return Math.min(
    MAX_QR_SESSION_TTL_SECONDS,
    Math.max(MIN_QR_SESSION_TTL_SECONDS, Math.trunc(ttlSeconds)),
  );
}

function toQrPayload(sessionId: string): string {
  return `${QR_SESSION_PREFIX}${sessionId}`;
}

function toSessionView(document: QrSessionDocument): QrSessionView {
  const now = Date.now();
  const isExpired = document.expiresAt.getTime() <= now;

  const status: QrSessionState =
    isExpired && document.status === "pending" ? "expired" : document.status;

  return {
    sessionId: document._id.toHexString(),
    status,
    createdAt: document.createdAt.toISOString(),
    expiresAt: document.expiresAt.toISOString(),
    scannedAt: document.scannedAt ? document.scannedAt.toISOString() : null,
    user: document.scannedBy,
  };
}

function toQrSessionUser(user: UserDocument): QrSessionUser {
  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department ?? null,
    facultyId: user.faculty_id ?? null,
    phone: user.phone ?? null,
    alternateContact: user.alternateContact ?? null,
    parkingEligible: Boolean(user.parkingEligible),
    isActive: Boolean(user.isActive),
    allowedCars: user.allowedCars ?? [],
  };
}

function toObjectId(sessionId: string): ObjectId | null {
  if (!ObjectId.isValid(sessionId)) {
    return null;
  }

  return new ObjectId(sessionId);
}

export function resolveQrSessionId(
  qrPayload: string | undefined,
  sessionId: string | undefined,
): string | null {
  if (sessionId) {
    return sessionId.trim();
  }

  if (!qrPayload) {
    return null;
  }

  const trimmedPayload = qrPayload.trim();
  if (!trimmedPayload.startsWith(QR_SESSION_PREFIX)) {
    return null;
  }

  const derivedSessionId = trimmedPayload.slice(QR_SESSION_PREFIX.length).trim();
  return derivedSessionId.length > 0 ? derivedSessionId : null;
}

export async function createQrSession(
  ttlSeconds: number | undefined,
): Promise<{ session: QrSessionView; qrPayload: string; ttlSeconds: number }> {
  const normalizedTtlSeconds = normalizeTtlSeconds(ttlSeconds);
  const collection = await getCollection();
  const now = new Date();

  const document: QrSessionDocument = {
    _id: new ObjectId(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + normalizedTtlSeconds * 1000),
    scannedAt: null,
    scannedBy: null,
  };

  await collection.insertOne(document);

  return {
    session: toSessionView(document),
    qrPayload: toQrPayload(document._id.toHexString()),
    ttlSeconds: normalizedTtlSeconds,
  };
}

export async function getQrSessionById(
  sessionId: string,
): Promise<QrSessionLookup> {
  const objectId = toObjectId(sessionId);
  if (!objectId) {
    return {
      ok: false,
      reason: "INVALID_SESSION",
    };
  }

  const collection = await getCollection();
  const document = await collection.findOne({ _id: objectId });

  if (!document) {
    return {
      ok: false,
      reason: "NOT_FOUND",
    };
  }

  return {
    ok: true,
    session: toSessionView(document),
  };
}

export async function markQrSessionScanned(
  sessionId: string,
  user: UserDocument,
): Promise<QrSessionScanResult> {
  const objectId = toObjectId(sessionId);
  if (!objectId) {
    return {
      ok: false,
      reason: "INVALID_SESSION",
    };
  }

  const collection = await getCollection();
  const now = new Date();

  const updateResult = await collection.updateOne(
    {
      _id: objectId,
      status: "pending",
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: "scanned",
        scannedAt: now,
        scannedBy: toQrSessionUser(user),
        updatedAt: now,
      },
    },
  );

  if (updateResult.modifiedCount > 0) {
    const updatedDocument = await collection.findOne({ _id: objectId });

    if (!updatedDocument) {
      return {
        ok: false,
        reason: "NOT_FOUND",
      };
    }

    return {
      ok: true,
      session: toSessionView(updatedDocument),
    };
  }

  const existingDocument = await collection.findOne({ _id: objectId });
  if (!existingDocument) {
    return {
      ok: false,
      reason: "NOT_FOUND",
    };
  }

  if (existingDocument.expiresAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      reason: "EXPIRED",
    };
  }

  if (existingDocument.status === "scanned") {
    return {
      ok: false,
      reason: "ALREADY_SCANNED",
    };
  }

  return {
    ok: false,
    reason: "NOT_FOUND",
  };
}
