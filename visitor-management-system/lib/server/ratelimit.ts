import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Upstash-backed sliding-window rate limiting. If credentials aren't configured
// (local dev without Upstash), limiting is disabled and requests pass through —
// production must set the env vars.
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const enabled = Boolean(
  url && token && !url.includes("placeholder") && !url.includes("xxxx")
);

export const redis = enabled ? new Redis({ url: url!, token: token! }) : null;

function build(tokens: number, window: Parameters<typeof Ratelimit.slidingWindow>[1], prefix: string) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix,
    analytics: false,
  });
}

// Public visitor submissions: strict, per IP.
export const submitLimiter = build(5, "1 m", "rl:submit");
// Authenticated guard actions: generous, per user.
export const guardLimiter = build(60, "1 m", "rl:guard");
// Login attempts: strict, per IP (credential stuffing / brute force).
export const loginLimiter = build(10, "5 m", "rl:login");
// OTP requests: strict, per phone (3 requests / 10 min).
export const otpLimiter = build(3, "10 m", "rl:otp");
// Forgot-password requests: strict, per email (avoids inbox/SES bombing).
export const forgotPasswordLimiter = build(3, "15 m", "rl:forgot");

/** Returns true if allowed. A null limiter (dev) always allows. */
export async function allow(
  limiter: Ratelimit | null,
  key: string
): Promise<boolean> {
  if (!limiter) return true;
  const { success } = await limiter.limit(key);
  return success;
}
