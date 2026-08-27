import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";

/** Crypto-random, non-sequential token embedded in the Guest Pass QR. */
export function newVipToken(): string {
  return `GST-${randomBytes(9).toString("hex").toUpperCase()}`;
}

export const vipInclude = {
  hostStaff: { select: { name: true } },
  approvedBy: { select: { name: true } },
  entryGate: { select: { code: true, name: true } },
  exitGate: { select: { code: true } },
} as const;

export type VIPWithRelations = Prisma.VIPPassGetPayload<{
  include: typeof vipInclude;
}>;

export interface VIPDTO {
  id: string;
  token: string;
  guestName: string;
  guestPhone: string;
  purpose: string;
  vehicleNumber: string | null;
  status: string;
  hostStaffName: string;
  approver: { name: string; approvedAt: string } | null;
  entryGateCode: string | null;
  exitGateCode: string | null;
  validFrom: string | null;
  validUntil: string | null;
  enteredAt: string | null;
  exitedAt: string | null;
  createdAt: string;
}

export function toVIPDTO(p: VIPWithRelations): VIPDTO {
  return {
    id: p.id,
    token: p.token,
    guestName: p.guestName,
    guestPhone: p.guestPhone,
    purpose: p.purpose,
    vehicleNumber: p.vehicleNumber,
    status: effectiveStatus(p),
    hostStaffName: p.hostStaff.name,
    approver:
      p.approvedBy && p.approvedAt
        ? { name: p.approvedBy.name, approvedAt: p.approvedAt.toISOString() }
        : null,
    entryGateCode: p.entryGate?.code ?? null,
    exitGateCode: p.exitGate?.code ?? null,
    validFrom: p.validFrom?.toISOString() ?? null,
    validUntil: p.validUntil?.toISOString() ?? null,
    enteredAt: p.enteredAt?.toISOString() ?? null,
    exitedAt: p.exitedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

/** APPROVED but past its validity window → treat as expired for the guard's UI. */
export function effectiveStatus(p: {
  status: string;
  validUntil: Date | null;
}): string {
  if (p.status === "APPROVED" && p.validUntil && p.validUntil.getTime() < Date.now()) {
    return "EXPIRED";
  }
  return p.status;
}
