import type { Prisma } from "@prisma/client";

// The include shape shared by the queue + search queries.
export const visitInclude = {
  visitor: { select: { name: true, phone: true } },
  entryGate: { select: { code: true, name: true } },
  exitGate: { select: { code: true } },
} as const;

// Shape returned by a Prisma VisitLog query using `visitInclude`.
export type VisitWithVisitor = Prisma.VisitLogGetPayload<{
  include: typeof visitInclude;
}>;

// Trimmed, guard-facing view of a visit. No foreign staff ids or raw relations.
export interface VisitDTO {
  id: string;
  referenceCode: string;
  category: string;
  categoryLabel: string | null;
  name: string;
  phone: string;
  vehicleNumber: string | null;
  details: unknown;
  selfieUrl: string;
  status: string;
  entryGateId: string;
  entryGateCode: string;
  entryGateName: string;
  exitGateId: string | null;
  exitGateCode: string | null;
  createdAt: string;
  approvedAt: string | null;
  exitedAt: string | null;
}

export function toVisitDTO(v: VisitWithVisitor): VisitDTO {
  return {
    id: v.id,
    referenceCode: v.referenceCode,
    category: v.category,
    categoryLabel: v.categoryLabel,
    name: v.visitor.name,
    phone: v.visitor.phone,
    vehicleNumber: v.vehicleNumber,
    details: v.details,
    selfieUrl: v.selfieUrl,
    status: v.status,
    entryGateId: v.entryGateId,
    entryGateCode: v.entryGate.code,
    entryGateName: v.entryGate.name,
    exitGateId: v.exitGateId,
    exitGateCode: v.exitGate?.code ?? null,
    createdAt: v.createdAt.toISOString(),
    approvedAt: v.approvedAt ? v.approvedAt.toISOString() : null,
    exitedAt: v.exitedAt ? v.exitedAt.toISOString() : null,
  };
}
