import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(500),
  password: z.string().min(8).max(200),
});
