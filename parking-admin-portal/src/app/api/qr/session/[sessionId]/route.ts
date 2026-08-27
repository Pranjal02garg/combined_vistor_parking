import { NextRequest } from "next/server";

import { getQrSessionById } from "@/lib/auth/qr-session";
import { withQrCorsHeaders } from "@/lib/http/cors";
import { jsonNoStore } from "@/lib/http/response";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: withQrCorsHeaders(),
  });
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    const { sessionId } = await context.params;
    const lookup = await getQrSessionById(sessionId);

    if (!lookup.ok) {
      return jsonNoStore(
        {
          error: "NOT_FOUND",
          message: "QR session not found.",
        },
        {
          status: 404,
          headers: withQrCorsHeaders(),
        },
      );
    }

    if (lookup.session.status === "expired") {
      return jsonNoStore(lookup.session, {
        status: 410,
        headers: withQrCorsHeaders(),
      });
    }

    return jsonNoStore(lookup.session, {
      headers: withQrCorsHeaders(),
    });
  } catch {
    return jsonNoStore(
      {
        error: "SERVER_ERROR",
        message: "Unable to read QR session.",
      },
      {
        status: 500,
        headers: withQrCorsHeaders(),
      },
    );
  }
}
