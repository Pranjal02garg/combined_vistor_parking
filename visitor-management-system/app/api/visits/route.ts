import type { Prisma, VisitStatus } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { uploadSelfie } from "@/lib/server/blob";
import { submitLimiter, allow } from "@/lib/server/ratelimit";
import { ok, fail, parseOr400, clientIp, sameOrigin } from "@/lib/server/http";
import { createVisitBaseSchema } from "@/lib/validation/visit";
import {
  getCategoryConfig,
  validateAgainstConfig,
  buildFieldsSnapshot,
} from "@/lib/server/forms";
import { generateSecureReferenceId } from "@/lib/security";
import { verifyOtpToken } from "@/lib/server/otp";

// POST /api/visits — PUBLIC. A visitor submits a check-in.
// Category + fields are now validated DYNAMICALLY against the DB form config,
// and a self-contained snapshot (label + value) is stored so the record renders
// correctly even if HEAD later edits/archives the form.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > 5 * 1024 * 1024) return fail(413, "Payload too large");

  if (!(await allow(submitLimiter, clientIp(req)))) {
    return fail(429, "Too many requests, slow down");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const parsed = parseOr400(createVisitBaseSchema, body);
  if (!parsed.ok) return parsed.res;
  const { entryGate, name, phone, selfie, fields, otpToken } = parsed.data;

  // Resolve the category against the live form config.
  const categoryKey = String(fields.category);
  const cat = await getCategoryConfig(categoryKey);
  if (!cat) return fail(400, "Unknown category");

  const { category: _drop, ...rawValues } = fields;
  if (typeof rawValues.vehicleNumber === "string") {
    rawValues.vehicleNumber = rawValues.vehicleNumber.toUpperCase().trim();
  }
  const result = validateAgainstConfig(cat, {
    ...rawValues,
    name,
    phone,
  });
  if (!result.ok) return fail(400, "Validation failed", result.errors);

  // All visitors must provide a valid OTP token.
  if (!verifyOtpToken(phone, otpToken)) {
    return fail(400, "Phone verification failed or expired");
  }

  const { isPhoneBlacklisted } = await import("@/lib/server/blacklist");
  if (await isPhoneBlacklisted(phone)) {
    return fail(403, "You are blacklisted from entering the premises.");
  }

  const gate = await prisma.gate.findFirst({
    where: { code: entryGate, isActive: true },
    select: { id: true },
  });
  if (!gate) return fail(400, "Unknown or inactive gate");

  let selfieUrl: string = selfie;
  if (!selfie.startsWith("http") && !selfie.startsWith("/uploads/")) {
    try {
      selfieUrl = await uploadSelfie(selfie);
    } catch {
      return fail(422, "Could not process the photo");
    }
  }

  const vehicleNumber = result.clean.vehicleNumber
    ? result.clean.vehicleNumber.toUpperCase()
    : null;
  const fieldsSnapshot = buildFieldsSnapshot(cat, result.clean);

  // 24-Hour Multi-Entry Day Pass handling for Delivery & Vendor categories
  const isDayPassCategory = categoryKey === "DELIVERY" || categoryKey === "VENDOR";
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  if (isDayPassCategory) {
    const existingDayPass = await prisma.visitLog.findFirst({
      where: {
        visitor: { phone },
        category: categoryKey,
        createdAt: { gte: startOfToday },
        status: { not: "REJECTED" },
      },
      include: { entryGate: { select: { code: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (existingDayPass) {
      return ok({
        id: existingDayPass.id,
        referenceCode: existingDayPass.referenceCode,
        category: existingDayPass.category,
        categoryLabel: existingDayPass.categoryLabel,
        isDayPass: true,
        reused: true,
      });
    }
  }

  // Block duplicate active sessions for regular visitors
  const activeStatuses: VisitStatus[] = ["PENDING", "APPROVED", "ESCALATED"];
  
  const existingByPhone = await prisma.visitLog.findFirst({
    where: { 
      visitor: { phone }, 
      status: { in: activeStatuses }
    },
    select: { id: true }
  });
  const existingVipByPhone = await prisma.vIPPass.findFirst({
    where: { guestPhone: phone, status: "CHECKED_IN" },
    select: { id: true }
  });
  if (existingByPhone || existingVipByPhone) {
    return fail(409, "A visit is already active or pending for this phone number");
  }

  if (vehicleNumber) {
    const existingByVehicle = await prisma.visitLog.findFirst({
      where: { 
        vehicleNumber,
        status: { in: activeStatuses }
      },
      select: { id: true }
    });
    const existingVipByVehicle = await prisma.vIPPass.findFirst({
      where: { vehicleNumber, status: "CHECKED_IN" },
      select: { id: true }
    });
    if (existingByVehicle || existingVipByVehicle) {
      return fail(409, "A visit is already active or pending for this vehicle number");
    }
  }

  try {
    const visitor = await prisma.visitor.upsert({
      where: { phone },
      update: { name },
      create: { phone, name },
      select: { id: true },
    });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const visit = await prisma.visitLog.create({
          data: {
            referenceCode: generateSecureReferenceId(),
            category: categoryKey,
            categoryLabel: cat.label,
            details: result.clean as Prisma.InputJsonValue,
            fieldsSnapshot: fieldsSnapshot as unknown as Prisma.InputJsonValue,
            selfieUrl,
            vehicleNumber,
            phoneVerified: true,
            visitorId: visitor.id,
            entryGateId: gate.id,
          },
          select: { referenceCode: true, status: true },
        });
        return ok(visit, { status: 201 });
      } catch (e) {
        if (isUniqueViolation(e) && attempt === 0) continue;
        throw e;
      }
    }
    return fail(500, "Could not create visit");
  } catch {
    return fail(500, "Could not create visit");
  }
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}
