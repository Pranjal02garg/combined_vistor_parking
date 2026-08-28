import { prisma } from "@/lib/server/prisma";
import { getMobileUser } from "@/lib/server/mobile-auth";
import { ok, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// The mobile app posts its Expo push token here after login so the server can
// notify this user (pass approved, maid checked in, …).
export async function POST(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return fail(401, "Unauthorized");

  let body: { pushToken?: string } = {};
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid body");
  }

  const token = (body.pushToken || "").trim();
  if (!token.startsWith("ExponentPushToken") && !token.startsWith("ExpoPushToken")) {
    return fail(400, "Invalid Expo push token");
  }

  await prisma.user.update({ where: { id: user.id }, data: { pushToken: token } });
  return ok({ ok: true });
}
