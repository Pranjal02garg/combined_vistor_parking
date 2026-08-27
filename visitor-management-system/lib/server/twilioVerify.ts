// Twilio Verify integration — Twilio generates, sends, and checks the OTP code
// itself, so it works on a free trial account (custom SMS bodies are blocked on
// trial, but Verify uses Twilio's own approved templates). Activated only when
// TWILIO_VERIFY_SERVICE_SID is set; otherwise the app falls back to the
// self-managed code flow in otp.ts.

const BASE = "https://verify.twilio.com/v2/Services";

export function isTwilioVerifyEnabled(): boolean {
  return Boolean(
    process.env.TWILIO_VERIFY_SERVICE_SID &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  );
}

function authHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

/** E.164 for an Indian 10-digit number. */
function toE164(phone: string): string {
  return phone.startsWith("+") ? phone : `+91${phone}`;
}

/** Ask Twilio to send a verification code via SMS or WhatsApp. Throws on failure. */
export async function startVerification(phone: string, channel: "sms" | "whatsapp" = "whatsapp"): Promise<void> {
  const service = process.env.TWILIO_VERIFY_SERVICE_SID!;
  const body = new URLSearchParams({ To: toE164(phone), Channel: channel });

  const res = await fetch(`${BASE}/${service}/Verifications`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({} as any));
    throw new Error(data.message || `Twilio Verify start failed (status ${res.status})`);
  }
}

/** Check a code against Twilio Verify. Returns true only when approved. */
export async function checkVerification(phone: string, code: string): Promise<boolean> {
  const service = process.env.TWILIO_VERIFY_SERVICE_SID!;
  const body = new URLSearchParams({ To: toE164(phone), Code: code });

  const res = await fetch(`${BASE}/${service}/VerificationCheck`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    // 404 == no pending/expired verification for this number → treat as wrong code.
    return false;
  }
  const data = await res.json().catch(() => ({} as any));
  return data.status === "approved";
}
