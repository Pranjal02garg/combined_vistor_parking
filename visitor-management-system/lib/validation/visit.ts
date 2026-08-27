import { z } from "zod";

// ---------------------------------------------------------------------------
// Server-authoritative validation. These schemas re-enforce everything the
// frontend checks (and more) so a tampered client cannot bypass the rules.
// ---------------------------------------------------------------------------

// Reusable primitives ------------------------------------------------------
export const text = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

export const personName = text(2, 60).regex(/^[a-zA-Z0-9\s.'-]+$/, "Valid name required");
export const phone = z.string().trim().regex(/^[0-9]{10}$/, "10 digits");
export const idString = z.string().trim().min(1).max(64); // cuid; DB lookup is the real check

export const vehicleRequired = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9\s-]{2,15}$/, "Invalid vehicle number");
export const vehicleOptional = z.union([vehicleRequired, z.literal("")]).optional();

// Base64 JPEG selfie: strict MIME + a hard size ceiling. sharp re-encodes it
// server-side afterwards, so this is the first (cheap) line of defence.
const MAX_SELFIE_BYTES = 3 * 1024 * 1024;
export const selfieSchema = z
  .string()
  .regex(
    /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/,
    "Invalid image payload"
  )
  .refine((s) => s.length <= MAX_SELFIE_BYTES * 1.37, "Image too large");

// Per-category dynamic fields ----------------------------------------------
// Each variant is a plain object so `discriminatedUnion` can key off `category`.
// Cross-field rules (e.g. Parent Pickup → hostel) are applied on the outer
// schema below, because refining a variant would break the discriminator.
export const categoryFields = z.discriminatedUnion("category", [
  z.object({
    category: z.literal("PARENT"),
    studentName: personName,
    purpose: z.enum(["Meeting", "Pickup", "Event", "Other"]),
    hostel: text(2, 30).optional(),
    vehicleNumber: vehicleRequired, // now mandatory for Parents
  }),
  z.object({
    category: z.literal("DELIVERY_VENDOR"),
    company: text(2, 50),
    purpose: z.enum([
      "Food Delivery",
      "Parcel / Courier",
      "Grocery",
      "Supplier / Vendor",
      "Service / Maintenance",
      "Other",
    ]),
    deliverTo: text(2, 60),
    vehicleNumber: vehicleOptional,
  }),
  z.object({
    category: z.literal("TAXI"),
    vehicleNumber: vehicleRequired,
    passenger: personName,
    point: text(2, 50),
  }),
  z.object({
    category: z.literal("CONTRACTOR"),
    company: text(2, 50),
    workOrder: text(2, 30),
    site: text(2, 50),
    vehicleNumber: vehicleRequired,
    workers: z.string().trim().regex(/^[0-9]{1,3}$/, "1–999"),
  }),
  z.object({
    category: z.literal("OFFICIAL"),
    organisation: text(2, 60),
    designation: text(2, 50),
    purpose: text(2, 80),
    meetPerson: personName,
    vehicleNumber: vehicleOptional,
  }),
  z.object({
    category: z.literal("STAFF"),
    employeeId: text(3, 20),
    department: text(2, 50),
    vehicleNumber: vehicleOptional,
  }),
  z.object({
    category: z.literal("RESIDENT"),
    residentType: z.enum(["Faculty", "Hostel", "Family Quarters"]),
    block: text(2, 30),
    passNo: text(2, 20),
    vehicleNumber: vehicleOptional,
  }),
  z.object({
    category: z.literal("OTHERS"),
    purpose: text(2, 80),
    meetPerson: text(2, 60),
    vehicleNumber: vehicleOptional,
  }),
]);

export type CategoryFields = z.infer<typeof categoryFields>;

// Public visitor submission (POST /api/visits) -----------------------------
export const createVisitSchema = z
  .object({
    // Gate the visitor is at — the stable QR `code` (e.g. "1"), resolved server-side.
    entryGate: text(1, 32),
    name: personName, // hoisted onto Visitor
    phone, //            hoisted onto Visitor (dedupe key)
    selfie: selfieSchema,
    fields: categoryFields,
    // Present only for Parents; its HMAC validity is checked in the handler.
    otpToken: z.string().max(256).optional(),
  })
  .superRefine((data, ctx) => {
    const f = data.fields;
    // Mirror the frontend `requiredWhen`: Parent hostel is required for Pickup.
    if (f.category === "PARENT" && f.purpose === "Pickup" && !f.hostel?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["fields", "hostel"],
        message: "Hostel is required for a pickup",
      });
    }
    // All visitors must complete OTP verification before submitting.
    if (!data.otpToken) {
      ctx.addIssue({
        code: "custom",
        path: ["otpToken"],
        message: "Phone OTP verification is required",
      });
    }
  });

export type CreateVisitInput = z.infer<typeof createVisitSchema>;

// Public submission — base envelope only. The category-specific `fields` are
// validated dynamically against the DB form config (see lib/server/forms.ts).
export const createVisitBaseSchema = z.object({
  entryGate: text(1, 32),
  name: personName,
  phone,
  selfie: selfieSchema,
  otpToken: z.string().max(256).optional(),
  fields: z
    .object({ category: z.string().trim().min(1).max(64) })
    .passthrough(),
});

// Guard operations ---------------------------------------------------------
export const queueQuerySchema = z.object({
  gateId: idString,
  cursor: idString.optional(), // keyset pagination
});

export const decisionSchema = z.object({
  action: z.enum(["approve", "reject", "escalate"]),
  onDutyGuard: z.string().trim().max(100).optional(),
});

export const exitSchema = z.object({
  referenceCode: z.string().trim().regex(/^VMS-[A-Z0-9]{4,12}$/, "Bad reference"),
  exitGateId: idString,
  onDutyGuard: z.string().trim().max(100).optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(40),
});
