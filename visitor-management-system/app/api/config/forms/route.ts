import { ok } from "@/lib/server/http";
import { getFormConfig } from "@/lib/server/forms";

// GET /api/config/forms — PUBLIC. The active intake form config (categories →
// fields → options), for the visitor form to render dynamically.
export async function GET() {
  const categories = await getFormConfig();
  return ok({ categories });
}
