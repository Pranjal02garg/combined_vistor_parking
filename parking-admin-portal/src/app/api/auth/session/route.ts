import { getCurrentAuth } from "@/lib/auth/service";
import { jsonNoStore } from "@/lib/http/response";

export async function GET(): Promise<Response> {
  try {
    const auth = await getCurrentAuth();

    if (!auth) {
      return jsonNoStore({ error: "Not authenticated." }, { status: 401 });
    }

    return jsonNoStore(auth);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    if (
      message.includes("MongoServerSelectionError") ||
      message.includes("querySrv") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND")
    ) {
      return jsonNoStore(
        {
          error:
            "Database connection failed. Verify MONGODB_URI and network access to MongoDB.",
        },
        { status: 503 },
      );
    }

    return jsonNoStore({ error: "Unable to read session." }, { status: 500 });
  }
}
