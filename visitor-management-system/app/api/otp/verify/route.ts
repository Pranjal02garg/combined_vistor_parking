import { submitLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail, parseOr400, clientIp, sameOrigin } from "@/lib/server/http";
import { otpVerifySchema } from "@/lib/validation/otp";
import { verifyOtpCode, issueOtpToken } from "@/lib/server/otp";

// POST /api/otp/verify — PUBLIC. Checks the code and returns a phone-bound token.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  if (!(await allow(submitLimiter, clientIp(req)))) {
    return fail(429, "Too many requests");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }
  const parsed = parseOr400(otpVerifySchema, body);
  if (!parsed.ok) return parsed.res;

  const isValid = await verifyOtpCode(parsed.data.phone, parsed.data.code);
  if (!isValid) {
    return fail(400, "Incorrect code");
  }

  return ok({ otpToken: issueOtpToken(parsed.data.phone) });
}
