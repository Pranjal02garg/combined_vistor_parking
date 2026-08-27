import { ObjectId } from "mongodb";

export interface AllowedCar {
  plateNumber: string;
  stickerColor: "green" | "red" | "blue";
}

export interface UserDocument {
  _id: ObjectId;
  name: string;
  department?: string | null;
  faculty_id?: string | null;
  phone?: string | null;
  alternateContact?: string | null;
  email: string;
  passwordHash: string;
  role: "admin" | "user";
  isActive: boolean;
  parkingEligible: boolean;
  eligibleFrom: Date | null;
  eligibleTill: Date | null;
  allowedCars: AllowedCar[];
  failedLoginAttempts: number;
  lockUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDocument {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  isActive: boolean;
  parkingEligible: boolean;
  eligibleFrom: string | null;
  eligibleTill: string | null;
  allowedCars: AllowedCar[];
  createdAt: string;
}

export interface AuthSession {
  id: string;
  expiresAt: string;
}

export interface AuthResult {
  user: PublicUser;
  session: AuthSession;
}

export interface MobileUser {
  id: string;
  email: string;
  role: "admin" | "user";
  name: string;
  department: string | null;
  faculty_id: string | null;
  phone: string | null;
  alternateContact: string | null;
  allowed: boolean;
  isActive: boolean;
}

export type MobileErrorCode =
  | "INVALID_PAYLOAD"
  | "INVALID_CREDENTIALS"
  | "INVALID_TOKEN"
  | "FORBIDDEN"
  | "ACCOUNT_LOCKED"
  | "RATE_LIMITED"
  | "HTTPS_REQUIRED"
  | "SERVER_ERROR";

export interface MobileErrorBody {
  error: MobileErrorCode;
  message: string;
  retryAfterSeconds?: number;
}
