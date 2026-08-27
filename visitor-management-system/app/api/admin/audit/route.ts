import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail } from "@/lib/server/http";

export async function GET(req: Request) {
  const head = await getGuard();
  if (!head) return fail(401, "Not signed in");
  if (head.role !== "HEAD") return fail(403, "HEAD only");

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { name: true, email: true } } }
  });

  return ok({ items: logs });
}
