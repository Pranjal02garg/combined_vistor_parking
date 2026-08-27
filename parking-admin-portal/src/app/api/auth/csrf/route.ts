import { issueCsrfToken } from "@/lib/auth/csrf";
import { jsonNoStore } from "@/lib/http/response";

export async function GET(): Promise<Response> {
  const csrfToken = await issueCsrfToken();

  return jsonNoStore({ csrfToken });
}
