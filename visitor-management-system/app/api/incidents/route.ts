import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

// GET /api/incidents — HEAD or STAFF. Admin sees all, Staff sees their own residence notices
export async function GET(req: Request) {
  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD" && user.role !== "STAFF") return fail(403, "Access restricted to Admin and Staff");

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");

  const whereClause: any = {};
  if (user.role === "STAFF" || scope === "my") {
    whereClause.staffId = user.userId;
  }

  const incidents = await prisma.incidentLog.findMany({
    where: whereClause,
    include: {
      staff: { select: { name: true, email: true } },
      reportedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const items = incidents.map((inc) => ({
    id: inc.id,
    title: inc.title,
    description: inc.description,
    severity: inc.severity,
    status: inc.status,
    staffId: inc.staffId,
    staffName: inc.staff?.name,
    quarterNumber: inc.quarterNumber,
    reportedByName: inc.reportedBy?.name || "Security Administration",
    resolution: inc.resolution,
    resolvedAt: inc.resolvedAt?.toISOString() || null,
    createdAt: inc.createdAt.toISOString(),
  }));

  return ok({ items });
}

// POST /api/incidents — HEAD Admin logs a new security / nuisance incident
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "HEAD") return fail(403, "Only Admin can file incident notices");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const title = (body.title || "").trim();
  const description = (body.description || "").trim();
  if (!title || !description) {
    return fail(400, "Title and description are required");
  }

  try {
    // Resolve valid reporter ID (fallback to any HEAD user if session ID changed on DB reset)
    let reporterId = user.userId;
    const reporterExists = await prisma.user.findUnique({ where: { id: reporterId } });
    if (!reporterExists) {
      const headUser = await prisma.user.findFirst({ where: { role: "HEAD" } });
      if (headUser) {
        reporterId = headUser.id;
      }
    }

    // Verify staffId if provided
    let assignedStaffId = body.staffId || null;
    if (assignedStaffId) {
      const staffExists = await prisma.user.findUnique({ where: { id: assignedStaffId } });
      if (!staffExists) {
        assignedStaffId = null;
      }
    }

    const incident = await prisma.incidentLog.create({
      data: {
        title,
        description,
        severity: body.severity || "MEDIUM",
        status: "FLAGGED",
        staffId: assignedStaffId,
        quarterNumber: body.quarterNumber ? body.quarterNumber.trim() : null,
        reportedById: reporterId,
      },
      include: {
        staff: { select: { name: true } },
        reportedBy: { select: { name: true } },
      },
    });

    return ok({
      id: incident.id,
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      status: incident.status,
      staffId: incident.staffId,
      staffName: incident.staff?.name,
      quarterNumber: incident.quarterNumber,
      reportedByName: incident.reportedBy?.name || "Security Administration",
      resolution: null,
      resolvedAt: null,
      createdAt: incident.createdAt.toISOString(),
    });
  } catch (err: any) {
    console.error("[Create Incident Error]", err);
    return fail(500, err?.message || "Failed to log incident notice");
  }
}
