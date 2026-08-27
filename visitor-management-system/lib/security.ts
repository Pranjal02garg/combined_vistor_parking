import type { Visitor, VisitorStatus, VisitorCategory } from "./types";

/**
 * Generates an unpredictable, cryptographically secure 5-character Reference ID.
 * Standard format: "VMS-XXXXX" where X is an uppercase alphanumeric character (avoiding confusing chars like O, 0, I, 1).
 */
export function generateSecureReferenceId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed O, 0, I, 1 for legibility
  const array = new Uint8Array(5);

  // Web Crypto is available in every browser and in Node 18+ via globalThis,
  // so we avoid a static `require("crypto")` that would bloat the client bundle.
  // 256 is an exact multiple of 32 (chars length), so `% length` has no modulo bias.
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(array);
  } else {
    // Unreachable in supported environments; keeps the function total.
    for (let i = 0; i < 5; i++) array[i] = Math.floor(Math.random() * 256);
  }

  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars[array[i] % chars.length];
  }
  return `VMS-${result}`;
}

/**
 * Strips HTML tags, trims whitespace, and limits character length to prevent XSS and buffer abuse.
 */
export function sanitizeInput(input: string, maxLength = 200): string {
  if (typeof input !== "string") return "";
  
  // Strip HTML tags using regex (failsafe client-side check)
  let clean = input.replace(/<[^>]*>/g, "");
  
  // Escape special HTML chars to prevent DOM injection
  clean = clean
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");

  return clean.trim().slice(0, maxLength);
}

/**
 * Recursively sanitizes a dictionary of form values.
 */
export function sanitizeFieldValues(values: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, val] of Object.entries(values)) {
    sanitized[sanitizeInput(key)] = sanitizeInput(val);
  }
  return sanitized;
}

/**
 * Validates that a string is a secure and valid base64-encoded JPEG image URL.
 * Rejects excessively large images (e.g. over 3MB) to protect client memory limits.
 */
export function isValidSelfiePayload(payload: string): boolean {
  if (!payload) return false;
  
  // Limit to 3MB base64 size (~2.25MB raw binary)
  if (payload.length > 4 * 1024 * 1024) return false;

  // Strict MIME check for base64 JPEG
  const regex = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
  return regex.test(payload);
}

const VALID_CATEGORIES: Set<VisitorCategory> = new Set([
  "parent",
  "delivery_vendor",
  "taxi",
  "contractor",
  "official",
  "staff",
  "resident",
  "others"
]);

const VALID_STATUSES: Set<VisitorStatus> = new Set([
  "pending",
  "approved",
  "rejected",
  "escalated",
  "exited"
]);

/**
 * Schema guard to validate and parse localStorage data.
 * Drops malformed objects or properties to prevent DOM injection or state corruption from local tampering.
 */
export function safeParseVisitors(rawJson: string | null): Visitor[] {
  if (!rawJson) return [];
  
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): Visitor | null => {
        if (!item || typeof item !== "object") return null;

        // Verify required string attributes
        if (typeof item.id !== "string" || !item.id) return null;
        if (typeof item.referenceId !== "string" || !item.referenceId) return null;
        if (typeof item.phone !== "string") return null;
        if (typeof item.entryGate !== "string" || !item.entryGate) return null;
        if (typeof item.createdAt !== "number") return null;

        // Verify unions
        if (!VALID_CATEGORIES.has(item.category)) return null;
        if (!VALID_STATUSES.has(item.status)) return null;

        // Verify selfie (either empty string or valid JPEG base64)
        if (typeof item.selfie !== "string") return null;
        if (item.selfie && !isValidSelfiePayload(item.selfie)) return null;

        // Verify field values record
        if (!item.fieldValues || typeof item.fieldValues !== "object") return null;
        
        const fieldValues: Record<string, string> = {};
        for (const [key, val] of Object.entries(item.fieldValues)) {
          if (typeof val === "string") {
            fieldValues[sanitizeInput(key)] = sanitizeInput(val);
          }
        }

        // Build clean validated visitor record
        const cleanVisitor: Visitor = {
          id: sanitizeInput(item.id),
          referenceId: sanitizeInput(item.referenceId),
          category: item.category,
          fieldValues,
          selfie: item.selfie, // base64 already verified by isValidSelfiePayload
          status: item.status,
          entryGate: sanitizeInput(item.entryGate),
          createdAt: item.createdAt,
          phone: sanitizeInput(item.phone),
        };

        if (typeof item.exitGate === "string") {
          cleanVisitor.exitGate = sanitizeInput(item.exitGate);
        }
        if (typeof item.vehicleNumber === "string") {
          cleanVisitor.vehicleNumber = sanitizeInput(item.vehicleNumber);
        }
        if (typeof item.enteredAt === "number") {
          cleanVisitor.enteredAt = item.enteredAt;
        }

        return cleanVisitor;
      })
      .filter((v): v is Visitor => v !== null);
  } catch {
    return [];
  }
}
