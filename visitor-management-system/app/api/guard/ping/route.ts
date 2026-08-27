import { prisma } from "@/lib/server/prisma";
import { getGuard } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const guard = await getGuard();
  if (!guard) return fail(401, "Not signed in");
  
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  if (!body.gateId || !body.guardName) {
    return fail(400, "Missing gateId or guardName");
  }

  // Upsert the session for this gate
  // If the same guard name is on the same gate, update lastPingAt.
  // Otherwise, create a new session record or update the existing one.
  
  let session = await prisma.guardSession.findFirst({
    where: { gateId: body.gateId, guardName: body.guardName }
  });

  if (session) {
    await prisma.guardSession.update({
      where: { id: session.id },
      data: { lastPingAt: new Date() }
    });
  } else {
    await prisma.guardSession.create({
      data: {
        gateId: body.gateId,
        guardName: body.guardName,
      }
    });
  }

  return ok({ success: true });
}
