import { z } from "zod";
import { personName, phone, text, idString, vehicleOptional } from "./visit";

const tokenField = z.string().trim().min(6).max(64);

export const createVIPSchema = z
  .object({
    guestName: personName,
    // Mobile number is optional now — accept a blank string or a valid 10-digit number.
    guestPhone: z.union([phone, z.literal("")]).optional(),
    // Purpose is derived server-side from visitType (+ tier); routing depends on it.
    visitType: z.enum(["PERSONAL", "OFFICIAL"]),
    tier: z.enum(["VIP", "GUEST", "GENERAL"]).optional(),
    vehicleNumber: vehicleOptional,
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),
  })
  .refine(
    (v) => !v.validFrom || !v.validUntil || v.validFrom <= v.validUntil,
    { path: ["validUntil"], message: "validUntil must be after validFrom" }
  );

// HEAD "custom pass" creation keeps the original free-text shape (this feature
// is unchanged by the staff-portal routing work).
export const adminCreateVIPSchema = z
  .object({
    guestName: personName,
    guestPhone: phone,
    purpose: text(2, 120),
    vehicleNumber: vehicleOptional,
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),
  })
  .refine(
    (v) => !v.validFrom || !v.validUntil || v.validFrom <= v.validUntil,
    { path: ["validUntil"], message: "validUntil must be after validFrom" }
  );

export const vipDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export const vipVerifyQuerySchema = z.object({ token: tokenField });

export const vipGateActionSchema = z.object({
  token: tokenField,
  gateId: idString,
  onDutyGuard: z.string().trim().max(100).optional(),
});
