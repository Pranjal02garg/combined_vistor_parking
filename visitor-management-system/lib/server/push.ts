import { prisma } from "@/lib/server/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

/**
 * Send an Expo push notification to a single user (by id). No-ops silently if
 * the user has no registered device token. Fire-and-forget: callers should not
 * block a request on delivery — wrap in `void sendPushToUser(...)`.
 */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });
    if (!user?.pushToken) return;

    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: user.pushToken,
        sound: "default",
        title: msg.title,
        body: msg.body,
        data: msg.data ?? {},
      }),
    });
  } catch (err) {
    // Never let a notification failure break the originating request.
    console.error("[push] failed to send:", err);
  }
}
