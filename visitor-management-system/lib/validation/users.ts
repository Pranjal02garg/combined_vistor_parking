import { z } from "zod";
import { personName, idString } from "./visit";

// ---------------------------------------------------------------------------
// Admin (HEAD) staff/guard account management. HEAD accounts are intentionally
// not creatable/editable here — only STAFF and GUARD — so this surface can't
// be used to escalate privileges.
// ---------------------------------------------------------------------------

const manageableRole = z.enum(["STAFF", "GUARD"]);
const password = z.string().min(8).max(200);

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: personName,
  role: manageableRole,
  password: password.optional(), // omitted → a temp password is generated + emailed
  gateIds: z.array(idString).max(10).optional(), // relevant for GUARD
});

export const userUpdateSchema = z.object({
  name: personName.optional(),
  role: manageableRole.optional(),
  isActive: z.boolean().optional(),
  gateIds: z.array(idString).max(10).optional(),
});
