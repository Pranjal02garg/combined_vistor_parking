import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

/**
 * Unified SMS sender supporting Fast2SMS, MSG91, AWS SNS, Twilio, and Dev Fallback.
 * @param phone 10-digit Indian phone number (e.g. "9812345670")
 * @param message Text message body
 * @param code 6-digit numeric OTP code
 */
export async function sendSMS(phone: string, message: string, code?: string): Promise<void> {
  const provider = (process.env.SMS_PROVIDER || "fast2sms").toLowerCase();

  // 1. Fast2SMS Integration (Fastest for India — Quick SMS route)
  if (provider === "fast2sms" || (!process.env.SMS_PROVIDER && process.env.FAST2SMS_API_KEY)) {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
      console.warn("[SMS Warning] FAST2SMS_API_KEY is not set in .env.");
      console.log(`[SMS Log] Phone: +91${phone} | Code: ${code}`);
      return;
    }

    const smsText = `Your Thapar campus entry code is ${code}. Valid for 10 minutes.`;

    // Fast2SMS Quick SMS via GET API (No DLT or URL verification required)
    const getUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(apiKey)}&route=q&message=${encodeURIComponent(smsText)}&numbers=${encodeURIComponent(phone)}`;

    try {
      const res = await fetch(getUrl, { method: "GET" });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.return === true) {
        console.log(`[Fast2SMS Success] Sent Quick SMS to +91${phone}`);
        return;
      }

      const errMsg = Array.isArray(data.message)
        ? data.message.join(", ")
        : (data.message || `Fast2SMS returned status ${res.status}`);

      console.error("[Fast2SMS Error]", errMsg);

      if (process.env.NODE_ENV !== "production") {
        console.warn(`[SMS Dev Fallback] Fast2SMS dispatch: ${errMsg}. Dev OTP Code: ${code}`);
        return;
      }
      throw new Error(errMsg);
    } catch (err: any) {
      console.error("[Fast2SMS Fetch Error]", err?.message || err);
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[SMS Dev Fallback] Fast2SMS fetch error: ${err?.message}. Dev OTP Code: ${code}`);
        return;
      }
      throw err;
    }
  }

  // 2. MSG91 Integration
  if (provider === "msg91" || (!process.env.SMS_PROVIDER && process.env.MSG91_AUTH_KEY)) {
    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) {
      console.warn("[SMS Warning] MSG91_AUTH_KEY is not set in .env. Falling back to console log.");
      console.log(`[SMS Log] Phone: +91${phone} | Code: ${code} | Message: ${message}`);
      return;
    }

    const templateId = process.env.MSG91_TEMPLATE_ID;
    const cleanPhone = phone.startsWith("91") ? phone : `91${phone}`;

    if (templateId && code) {
      const endpoints = [
        `https://api.msg91.com/api/v5/otp?template_id=${encodeURIComponent(templateId)}&mobile=${encodeURIComponent(cleanPhone)}&otp=${encodeURIComponent(code)}`,
        `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(templateId)}&mobile=${encodeURIComponent(cleanPhone)}&otp=${encodeURIComponent(code)}`
      ];

      let lastError: Error | null = null;
      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              authkey: authKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ otp: code }),
          });

          const data = await res.json().catch(() => ({}));
          if (res.ok && data.type !== "error") {
            console.log(`[MSG91 Success] Sent OTP ${code} to +91${phone}`);
            return;
          }
          lastError = new Error(data.message || `MSG91 OTP API failed with status ${res.status}`);
        } catch (err: any) {
          lastError = err;
        }
      }

      console.error("[MSG91 Error]", lastError?.message || lastError);
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[SMS Dev Fallback] Could not reach MSG91 servers (${lastError?.message}). Dev OTP Code: ${code}`);
        return;
      }
      throw lastError || new Error("MSG91 OTP API request failed");
    } else {
      console.warn("[SMS Warning] MSG91_TEMPLATE_ID is missing in .env.");
      console.log(`[SMS Log] Phone: +91${phone} | Code: ${code} | Message: ${message}`);
      return;
    }
  }

  // 3. AWS SNS Integration
  if (provider === "aws_sns") {
    const sns = new SNSClient({ region: process.env.AWS_REGION ?? "ap-south-1" });
    await sns.send(
      new PublishCommand({
        PhoneNumber: `+91${phone}`,
        Message: message,
        MessageAttributes: {
          "AWS.SNS.SMS.SenderID": { DataType: "String", StringValue: "THAPAR" },
          "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
        },
      })
    );
    return;
  }

  // 4. Twilio Integration
  if (provider === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!sid || !token || !from) {
      throw new Error("Twilio configuration incomplete (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER required)");
    }

    const credentials = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({
      To: `+91${phone}`,
      From: from,
      Body: message,
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Twilio SMS failed with status ${res.status}`);
    }
    return;
  }

  // 5. Default Console Log for local development
  console.log(`[SMS Console Fallback] Phone: +91${phone} | Code: ${code} | Message: ${message}`);
}
