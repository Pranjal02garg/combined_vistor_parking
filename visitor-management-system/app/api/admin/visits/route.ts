import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { adminCreateVisitSchema } from "@/lib/validation/admin";
import { uploadSelfie } from "@/lib/server/blob";
import { getCategoryConfig, validateAgainstConfig, buildFieldsSnapshot } from "@/lib/server/forms";
import { generateSecureReferenceId } from "@/lib/security";

async function requireHead() {
  const user = await getGuard();
  if (!user) return { res: fail(401, "Not signed in") };
  if (user.role !== "HEAD") return { res: fail(403, "HEAD only") };
  return { user };
}

// POST /api/admin/visits — HEAD. Create an auto-approved standard visit directly.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireHead();
  if ("res" in auth) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const parsed = parseOr400(adminCreateVisitSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  // Resolve category configuration
  const cat = await getCategoryConfig(d.category);
  if (!cat) return fail(400, "Unknown category");

  // Validate dynamically
  const validationFields = { ...d.fields };
  if (typeof validationFields.vehicleNumber === "string") {
    validationFields.vehicleNumber = validationFields.vehicleNumber.toUpperCase().trim();
  }
  const result = validateAgainstConfig(cat, {
    ...validationFields,
    name: d.name,
    phone: d.phone,
  });
  if (!result.ok) return fail(400, "Validation failed", result.errors);

  // Validate entry gate
  const gate = await prisma.gate.findFirst({
    where: { code: d.entryGateCode, isActive: true },
    select: { id: true },
  });
  if (!gate) return fail(400, "Unknown or inactive gate");

  // Process selfie if provided
  let selfieUrl = "";
  if (d.selfie) {
    try {
      selfieUrl = await uploadSelfie(d.selfie);
    } catch {
      return fail(422, "Could not process the photo");
    }
  }

  const vehicleNumber = result.clean.vehicleNumber
    ? result.clean.vehicleNumber.toUpperCase()
    : null;
  const fieldsSnapshot = buildFieldsSnapshot(cat, result.clean);
  const now = new Date();

  try {
    const visitor = await prisma.visitor.upsert({
      where: { phone: d.phone },
      update: { name: d.name },
      create: { phone: d.phone, name: d.name },
      select: { id: true },
    });

    const visit = await prisma.visitLog.create({
      data: {
        referenceCode: generateSecureReferenceId(),
        category: d.category,
        categoryLabel: cat.label,
        details: result.clean,
        fieldsSnapshot: fieldsSnapshot,
        selfieUrl,
        vehicleNumber,
        status: "APPROVED",
        phoneVerified: true, // Auto-verified by admin override
        visitorId: visitor.id,
        entryGateId: gate.id,
        approvedAt: now,
        decidedById: auth.user.userId,
      },
      select: { referenceCode: true, status: true },
    });

    return ok(visit, { status: 201 });
  } catch (e) {
    throw e;
  }
}
