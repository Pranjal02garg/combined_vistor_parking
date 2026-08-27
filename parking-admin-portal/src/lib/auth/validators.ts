import { z } from "zod";

import { MAX_PASSWORD_LENGTH } from "@/lib/auth/constants";
import { getPasswordValidationErrors } from "@/lib/auth/password-policy";

const emailSchema = z
  .string()
  .trim()
  .email("Please provide a valid email address.")
  .max(320)
  .transform((value) => value.toLowerCase())
  .refine((value) => value.endsWith(".edu"), {
    message: "Only .edu email addresses are allowed.",
  });

const passwordSchema = z
  .string()
  .max(MAX_PASSWORD_LENGTH)
  .superRefine((value, context) => {
    const errors = getPasswordValidationErrors(value);

    for (const error of errors) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: error,
      });
    }
  });

export const registerPayloadSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginPayloadSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

const currentPasswordSchema = z.string().min(1).max(MAX_PASSWORD_LENGTH);

const nonEmptyTextField = (max: number) =>
  z.string().trim().min(1).max(max);

const optionalNullableTextField = (max: number) =>
  z.union([nonEmptyTextField(max), z.null()]);

export const mobileLoginPayloadSchema = loginPayloadSchema;

export const mobileChangePasswordPayloadSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    newPassword: passwordSchema,
  })
  .superRefine((value, context) => {
    if (value.currentPassword === value.newPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "New password must be different from current password.",
      });
    }
  });

export const mobileProfilePatchPayloadSchema = z
  .object({
    name: nonEmptyTextField(120).optional(),
    department: optionalNullableTextField(120).optional(),
    phone: optionalNullableTextField(40).optional(),
    alternateContact: optionalNullableTextField(120).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field must be provided.",
  });

export type RegisterPayload = z.infer<typeof registerPayloadSchema>;
export type LoginPayload = z.infer<typeof loginPayloadSchema>;
export type MobileLoginPayload = z.infer<typeof mobileLoginPayloadSchema>;
export type MobileChangePasswordPayload = z.infer<
  typeof mobileChangePasswordPayloadSchema
>;
export type MobileProfilePatchPayload = z.infer<
  typeof mobileProfilePatchPayloadSchema
>;
