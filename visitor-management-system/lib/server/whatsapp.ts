/**
 * WhatsApp message sender supporting Twilio WhatsApp API, Meta WhatsApp Cloud API, and Dev Fallback.
 * @param phone 10-digit Indian phone number (e.g. "9812345670") or international number
 * @param message Text message body
 * @param code 6-digit numeric OTP code
 */
export async function sendWhatsApp(phone: string, message: string, code?: string): Promise<void> {
  const provider = (process.env.WHATSAPP_PROVIDER || "twilio").toLowerCase();
  const cleanPhone = phone.startsWith("+") ? phone : phone.startsWith("91") ? `+${phone}` : `+91${phone}`;

  // 1. Meta WhatsApp Cloud API (Graph API)
  if (provider === "meta" || provider === "meta_cloud" || process.env.WHATSAPP_ACCESS_TOKEN) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (accessToken && phoneNumberId) {
      const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanPhone.replace("+", ""),
            type: "text",
            text: { preview_url: false, body: message },
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && !data.error) {
          console.log(`[WhatsApp Meta Success] Sent OTP to ${cleanPhone}`);
          return;
        }

        const errMsg = data.error?.message || `Meta WhatsApp API returned status ${res.status}`;
        console.error("[WhatsApp Meta Error]", errMsg);

        if (process.env.NODE_ENV !== "production") {
          console.warn(`[WhatsApp Dev Fallback] Meta dispatch: ${errMsg}. Dev OTP Code: ${code}`);
          return;
        }
        throw new Error(errMsg);
      } catch (err: any) {
        console.error("[WhatsApp Meta Fetch Error]", err?.message || err);
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[WhatsApp Dev Fallback] Meta fetch error: ${err?.message}. Dev OTP Code: ${code}`);
          return;
        }
        throw err;
      }
    }
  }

  // 2. Twilio WhatsApp API
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  let fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;

  if (sid && token) {
    if (!fromNumber) {
      // Default to Twilio WhatsApp Sandbox number if not specified
      fromNumber = "+14155238886";
    }

    const from = fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`;
    const to = `whatsapp:${cleanPhone}`;

    const credentials = Buffer.from(`${sid}:${token}`).toString("base64");
    const contentSid = process.env.TWILIO_CONTENT_SID || "HX229f5a04fd0510ce1b071852155d3e75";

    // 1. Try sending with pre-approved ContentSid template
    if (code && contentSid) {
      try {
        const templateBody = new URLSearchParams({
          To: to,
          From: from,
          ContentSid: contentSid,
          ContentVariables: JSON.stringify({ "1": String(code) }),
        });

        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: templateBody.toString(),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.sid) {
          console.log(`[Twilio WhatsApp Success (Template)] Sent OTP ${code} to ${cleanPhone}`);
          return;
        }
      } catch (e: any) {
        console.warn("[Twilio WhatsApp Template Warning]", e?.message);
      }
    }

    // 2. Fallback to direct Body text message
    const body = new URLSearchParams({
      To: to,
      From: from,
      Body: message,
    });

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        console.log(`[Twilio WhatsApp Success (Direct)] Sent OTP ${code} to ${cleanPhone}`);
        return;
      }

      const errMsg = data.message || `Twilio WhatsApp failed with status ${res.status}`;
      console.error("[Twilio WhatsApp Error]", errMsg);

      if (process.env.NODE_ENV !== "production") {
        console.warn(`[WhatsApp Dev Fallback] Twilio WhatsApp dispatch: ${errMsg}. Dev OTP Code: ${code}`);
        return;
      }
      throw new Error(errMsg);
    } catch (err: any) {
      console.error("[Twilio WhatsApp Fetch Error]", err?.message || err);
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[WhatsApp Dev Fallback] Twilio fetch error: ${err?.message}. Dev OTP Code: ${code}`);
        return;
      }
      throw err;
    }
  }

  // 3. Fallback for Local Dev
  console.log(`[WhatsApp Console Fallback] Phone: ${cleanPhone} | Code: ${code} | Message: ${message}`);
}
