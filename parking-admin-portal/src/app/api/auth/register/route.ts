import { jsonNoStore } from "@/lib/http/response";

export async function POST(): Promise<Response> {
  return jsonNoStore(
    { error: "Public registration is disabled. Please contact an admin." },
    { status: 403 },
  );
}
