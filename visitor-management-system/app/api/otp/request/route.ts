import { otpLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail, parseOr400, clientIp, sameOrigin } from "@/lib/server/http";
import { otpRequestSchema } from "@/lib/validation/otp";
import { generateAndSendOtp } from "@/lib/server/otp";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }
  const parsed = parseOr400(otpRequestSchema, body);
  if (!parsed.ok) return parsed.res;

  // Rate limit per phone number to prevent SMS bombing
  const phone = parsed.data.phone;
  if (!(await allow(otpLimiter, `otp:${phone}`))) {
    return fail(429, "Too many requests. Please wait before trying again.");
  }

  try {
    const channel = parsed.data.channel || "whatsapp";
    const devCode = await generateAndSendOtp(phone, channel);
    return ok({ sent: true, channel, ...(devCode ? { devCode } : {}) });
  } catch (err: any) {
    console.error("[OTP Request Error]", err);
    return fail(502, err?.message || "Could not send the verification code. Please try again.");
  }
}
