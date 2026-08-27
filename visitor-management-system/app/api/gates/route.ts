import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail } from "@/lib/server/http";

// GET /api/gates — any operator. Returns ALL active gates. Guards now operate
// campus-wide (a guard at any gate can see all traffic and record entry/exit at
// the gate they are physically manning), so the picker lists every gate.
export async function GET() {
  const guard = await getGuard();
  if (!guard) return fail(401, "Not signed in");

  const gates = await prisma.gate.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  return ok({ gates });
}
