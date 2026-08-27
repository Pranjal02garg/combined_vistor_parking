import { prisma } from "@/lib/server/prisma";
import { ok, fail, sameOrigin } from "@/lib/server/http";

// GET /api/visitors?phone=...
// Fetches the visitor's base details (name) and most recent vehicle from VisitLog
export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const url = new URL(req.url);
  const phone = url.searchParams.get("phone");
  
  if (!phone || phone.length < 5 || phone.length > 20) {
    return fail(400, "Valid phone number required");
  }

  const visitor = await prisma.visitor.findUnique({
    where: { phone },
    select: {
      name: true,
      visitCount: true,
      lastVisitAt: true,
      overstayCount: true,
      visits: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          vehicleNumber: true,
          category: true,
          details: true,
          selfieUrl: true,
        }
      }
    }
  });

  if (!visitor) {
    return fail(404, "Visitor not found");
  }

  const latestVisit = visitor.visits[0];

  return ok({
    name: visitor.name,
    visitCount: visitor.visitCount,
    lastVisitAt: visitor.lastVisitAt,
    overstayCount: visitor.overstayCount,
    lastVehicleNumber: latestVisit?.vehicleNumber || null,
    category: latestVisit?.category || null,
    details: latestVisit?.details || null,
    selfieUrl: latestVisit?.selfieUrl || null,
  });
}
