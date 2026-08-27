import { NextRequest } from "next/server";
import { z } from "zod";

import { createQrSession } from "@/lib/auth/qr-session";
import { withQrCorsHeaders } from "@/lib/http/cors";
import { jsonNoStore } from "@/lib/http/response";

const createQrPayloadSchema = z.object({
  ttlSeconds: z.number().int().min(30).max(600).optional(),
});

type CreateQrSessionResult = Awaited<ReturnType<typeof createQrSession>>;

function buildCreateSessionResponse(payload: CreateQrSessionResult): Response {
  return jsonNoStore(
    {
      ...payload.session,
      qrPayload: payload.qrPayload,
      ttlSeconds: payload.ttlSeconds,
      pollPath: `/api/qr/session/${payload.session.sessionId}`,
    },
    {
      status: 201,
      headers: withQrCorsHeaders(),
    },
  );
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: withQrCorsHeaders(),
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const ttlFromQuery = request.nextUrl.searchParams.get("ttlSeconds");
    const parsedTtl = ttlFromQuery === null ? undefined : Number(ttlFromQuery);

    const payload = createQrPayloadSchema.safeParse({
      ttlSeconds: parsedTtl,
    });

    if (!payload.success) {
      return jsonNoStore(
        {
          error: "INVALID_PAYLOAD",
          message: payload.error.issues[0]?.message ?? "Invalid request payload.",
        },
        {
          status: 400,
          headers: withQrCorsHeaders(),
        },
      );
    }

    const createdSession = await createQrSession(payload.data.ttlSeconds);
    return buildCreateSessionResponse(createdSession);
  } catch {
    return jsonNoStore(
      {
        error: "SERVER_ERROR",
        message: "Unable to create QR session.",
      },
      {
        status: 500,
        headers: withQrCorsHeaders(),
      },
    );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    let requestBody: unknown = {};

    const rawBody = await request.text();
    if (rawBody.trim().length > 0) {
      try {
        requestBody = JSON.parse(rawBody);
      } catch {
        return jsonNoStore(
          {
            error: "INVALID_PAYLOAD",
            message: "Invalid request payload.",
          },
          {
            status: 400,
            headers: withQrCorsHeaders(),
          },
        );
      }
    }

    const payload = createQrPayloadSchema.safeParse(requestBody);
    if (!payload.success) {
      return jsonNoStore(
        {
          error: "INVALID_PAYLOAD",
          message: payload.error.issues[0]?.message ?? "Invalid request payload.",
        },
        {
          status: 400,
          headers: withQrCorsHeaders(),
        },
      );
    }

    const createdSession = await createQrSession(payload.data.ttlSeconds);
    return buildCreateSessionResponse(createdSession);
  } catch {
    return jsonNoStore(
      {
        error: "SERVER_ERROR",
        message: "Unable to create QR session.",
      },
      {
        status: 500,
        headers: withQrCorsHeaders(),
      },
    );
  }
}
