import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

// POST /api/guard/house-help/action — GUARD/HEAD. Record check-in / check-out for house help
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const user = await getGuard();
  if (!user) return fail(401, "Not signed in");
  if (user.role !== "GUARD" && user.role !== "HEAD") return fail(403, "Forbidden");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  const token = (body.token || "").trim().toUpperCase();
  const action = body.action; // "CHECK_IN" | "CHECK_OUT"
  const gateId = body.gateId || null;
  const remarks = body.remarks || null;

  if (!token) return fail(400, "Token is required");
  if (action !== "CHECK_IN" && action !== "CHECK_OUT") return fail(400, "Invalid action");

  const help = await prisma.houseHelp.findUnique({
    where: { token },
  });

  if (!help) return fail(404, "House help pass not found");

  const log = await prisma.houseHelpLog.create({
    data: {
      houseHelpId: help.id,
      gateId,
      action,
      remarks,
    },
  });

  return ok({
    success: true,
    action: log.action,
    timestamp: log.createdAt.toISOString(),
    message: `House Help ${help.name} ${action === "CHECK_IN" ? "Checked In" : "Checked Out"} successfully.`,
  });
}
