import { z } from "zod";
import { personName, phone, text, idString, vehicleOptional } from "./visit";

// ---- Form builder ---------------------------------------------------------
const machineKey = z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_]+$/, "letters/digits/underscore");
const fieldType = z.enum(["text", "tel", "select", "number"]);
const optionList = z
  .array(z.object({ value: text(1, 60), label: text(1, 60) }))
  .max(50)
  .optional();

export const categoryCreateSchema = z.object({
  key: machineKey,
  label: text(2, 60),
  description: text(0, 120).optional(),
  icon: text(0, 40).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export const categoryUpdateSchema = z.object({
  label: text(2, 60).optional(),
  description: text(0, 120).optional().nullable(),
  icon: text(0, 40).optional().nullable(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
});

export const fieldCreateSchema = z.object({
  categoryId: idString,
  name: machineKey,
  label: text(1, 60),
  type: fieldType,
  required: z.boolean().optional(),
  placeholder: text(0, 80).optional().nullable(),
  pattern: text(0, 200).optional().nullable(),
  maxLength: z.number().int().min(1).max(500).optional().nullable(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  requiredWhenField: text(0, 60).optional().nullable(),
  requiredWhenValue: text(0, 60).optional().nullable(),
  options: optionList,
});

export const fieldUpdateSchema = z.object({
  label: text(1, 60).optional(),
  type: fieldType.optional(),
  required: z.boolean().optional(),
  placeholder: text(0, 80).optional().nullable(),
  pattern: text(0, 200).optional().nullable(),
  maxLength: z.number().int().min(1).max(500).optional().nullable(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  requiredWhenField: text(0, 60).optional().nullable(),
  requiredWhenValue: text(0, 60).optional().nullable(),
  active: z.boolean().optional(),
  options: optionList, // when present, replaces the whole option list
});

// ---- Settings & blacklist -------------------------------------------------
export const settingsUpdateSchema = z.object({
  overstayMinutes: z.number().int().min(1).max(1440).optional(),
  defaulterThreshold: z.number().int().min(1).max(50).optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
});

export const blacklistCreateSchema = z.object({
  phone,
  name: personName.optional(),
  reason: text(2, 200),
  expiresAt: z.string().datetime().optional(),
});

export const blacklistUpdateSchema = z.object({
  name: personName.optional().nullable(),
  reason: text(2, 200).optional(),
  active: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

// ---- Record edits (HEAD) --------------------------------------------------
const visitStatus = z.enum(["PENDING", "APPROVED", "REJECTED", "ESCALATED", "EXITED"]);
const vipStatus = z.enum(["PENDING", "APPROVED", "REJECTED", "CHECKED_IN", "EXITED", "EXPIRED"]);

export const visitEditSchema = z.object({
  name: personName.optional(),
  phone: phone.optional(),
  vehicleNumber: vehicleOptional,
  details: z.record(z.string(), z.any()).optional(),
  detailsByLabel: z.record(z.string(), z.any()).optional(),
  status: visitStatus.optional(),
  entryGateCode: text(1, 32).optional(),
  exitGateCode: text(1, 32).optional().nullable(),
});

export const vipEditSchema = z.object({
  guestName: personName.optional(),
  guestPhone: phone.optional(),
  purpose: text(2, 120).optional(),
  vehicleNumber: vehicleOptional,
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  status: vipStatus.optional(),
});

// ---- Admin direct creation (bypass intake) --------------------------------
export const adminCreateVisitSchema = z.object({
  category: machineKey,
  name: personName,
  phone,
  entryGateCode: text(1, 32),
  selfie: z.string().max(4 * 1024 * 1024).optional(), // optional for HEAD
  fields: z.record(z.string(), z.any()).default({}),
});
