import { z } from "zod";

const tokenField = z.string().trim().min(4).max(64);

export const createVIPSchema = z
  .object({
    guestName: z.string().trim().min(1, "Name is required").max(100),
    guestPhone: z.string().trim().optional().nullable(),
    visitType: z.string().default("OFFICIAL"),
    tier: z.string().optional().nullable(),
    vehicleNumber: z.string().trim().optional().nullable(),
    validFrom: z.string().optional().nullable(),
    validUntil: z.string().optional().nullable(),
  });

export const adminCreateVIPSchema = z
  .object({
    guestName: z.string().trim().min(1, "Name is required").max(100),
    guestPhone: z.string().trim().optional().nullable(),
    purpose: z.string().trim().min(1).max(200),
    vehicleNumber: z.string().trim().optional().nullable(),
    validFrom: z.string().optional().nullable(),
    validUntil: z.string().optional().nullable(),
  });

export const vipDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export const vipVerifyQuerySchema = z.object({ token: tokenField });

export const vipGateActionSchema = z.object({
  token: tokenField,
  gateId: z.string().trim().min(1).max(64),
  onDutyGuard: z.string().trim().max(100).optional(),
});
