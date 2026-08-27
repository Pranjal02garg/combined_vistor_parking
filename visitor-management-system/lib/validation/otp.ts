import { z } from "zod";

export const otpRequestSchema = z.object({
  phone: z.string().trim().regex(/^[0-9]{10}$/, "10 digits"),
  channel: z.enum(["whatsapp", "sms"]).default("whatsapp").optional(),
});

export const otpVerifySchema = z.object({
  phone: z.string().trim().regex(/^[0-9]{10}$/, "10 digits"),
  code: z.string().trim().regex(/^[0-9]{4,8}$/, "Invalid code"),
});
