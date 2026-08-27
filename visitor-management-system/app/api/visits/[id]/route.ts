import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, parseOr400, sameOrigin } from "@/lib/server/http";
import { visitEditSchema } from "@/lib/validation/admin";
import { getCategoryConfig, validateAgainstConfig, buildFieldsSnapshot } from "@/lib/server/forms";

async function requireGuardOrHead() {
  const user = await getGuard();
  if (!user) return { res: fail(401, "Not signed in") };
  if (user.role !== "HEAD" && user.role !== "GUARD") return { res: fail(403, "Forbidden") };
  return { user };
}

// PATCH /api/visits/:id — HEAD/GUARD. Edit any standard visit record.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");
  const auth = await requireGuardOrHead();
  if ("res" in auth) return auth.res;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const parsed = parseOr400(visitEditSchema, body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  try {
    const errorMsg = await prisma.$transaction(async (tx) => {
      const visit = await tx.visitLog.findUnique({
        where: { id },
        select: {
          visitorId: true,
          category: true,
          details: true,
          visitor: { select: { name: true, phone: true } },
        },
      });
      if (!visit) return "Visit record not found";

      // 1. Update Visitor (Head only)
      if (d.name || d.phone) {
        if (auth.user.role === "GUARD") {
          return "Guards cannot edit name or phone number";
        }
        await tx.visitor.update({
          where: { id: visit.visitorId },
          data: {
            name: d.name,
            phone: d.phone,
          },
        });
      }

      // 2. Resolve Gate Codes to IDs
      let entryGateId: string | undefined;
      if (d.entryGateCode) {
        const g = await tx.gate.findFirst({ where: { code: d.entryGateCode } });
        if (!g) return "Unknown entry gate code";
        entryGateId = g.id;
      }

      let exitGateId: string | null | undefined;
      if (d.exitGateCode !== undefined) {
        if (d.exitGateCode === null) {
          exitGateId = null;
        } else {
          const g = await tx.gate.findFirst({ where: { code: d.exitGateCode } });
          if (!g) return "Unknown exit gate code";
          exitGateId = g.id;
        }
      }

      // 3. Dynamic category validations
      const currentDetails = (visit.details || {}) as Record<string, string>;
      const mergedDetails = {
        ...currentDetails,
        ...(d.details || {}),
        name: d.name || visit.visitor.name,
        phone: d.phone || visit.visitor.phone,
      };
      if (typeof (mergedDetails as any).vehicleNumber === "string") {
        (mergedDetails as any).vehicleNumber = (mergedDetails as any).vehicleNumber.toUpperCase().trim();
      }

      const cat = await getCategoryConfig(visit.category);
      if (cat && d.detailsByLabel) {
        for (const f of cat.fields) {
          if (d.detailsByLabel[f.label] !== undefined) {
            (mergedDetails as any)[f.name] = d.detailsByLabel[f.label];
          }
        }
      }

      let detailsJson: any = mergedDetails;
      let fieldsSnapshotJson: any = undefined;

      if (cat) {
        const validation = validateAgainstConfig(cat, mergedDetails);
        if (!validation.ok) {
          return `Validation failed: ${validation.errors.map((err) => `${err.field}: ${err.message}`).join(", ")}`;
        }
        detailsJson = validation.clean;
        fieldsSnapshotJson = buildFieldsSnapshot(cat, validation.clean);
      }

      // 4. Update VisitLog
      await tx.visitLog.update({
        where: { id },
        data: {
          details: detailsJson,
          fieldsSnapshot: fieldsSnapshotJson,
          status: d.status,
          vehicleNumber: d.vehicleNumber ? d.vehicleNumber.toUpperCase() : undefined,
          entryGateId,
          exitGateId,
          editedById: auth.user.userId,
          editedAt: new Date(),
        },
      });

      return null; // No errors
    });

    if (errorMsg) return fail(400, errorMsg);
    return ok({ id, message: "Visit record updated successfully" });
  } catch (e) {
    throw e;
  }
}
