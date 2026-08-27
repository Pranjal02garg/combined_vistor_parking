// ---------------------------------------------------------------------------
// One-off, idempotent sync of the live FormCategory / FormField data to match
// the reduced intake form (Parent, Vendor, Staff, Other) and the new Parent
// Purpose / Hostel rules. Mirrors lib/categories.ts so a fresh `db:seed` and the
// live DB agree.
//
// Run:  node --env-file=.env scripts/sync-forms.mjs
//
// Safe to run repeatedly. Only touches FormCategory rows (active/label/sortOrder)
// and the Parent category's `purpose` options + `hostel` field props. Existing
// visit history is untouched — archived categories keep their rows (active:false)
// so past VisitLog.category snapshots still resolve.
// ---------------------------------------------------------------------------
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// key => { active, label, sortOrder }. Keys are the uppercased seed ids.
const CATEGORY_PLAN = {
  PARENT: { active: true, label: "Parent", sortOrder: 0 },
  DELIVERY_VENDOR: { active: true, label: "Vendor", sortOrder: 1 },
  STAFF: { active: true, label: "Staff", sortOrder: 2 },
  OTHERS: { active: true, label: "Other", sortOrder: 3 },
  // Archived — hidden from the picker, history preserved.
  TAXI: { active: false },
  CONTRACTOR: { active: false },
  OFFICIAL: { active: false },
  RESIDENT: { active: false },
};

async function main() {
  console.log("=== Syncing FormCategory rows ===");
  for (const [key, plan] of Object.entries(CATEGORY_PLAN)) {
    const cat = await prisma.formCategory.findUnique({ where: { key } });
    if (!cat) {
      console.log(`  - ${key}: not found (skipped)`);
      continue;
    }
    const data = { active: plan.active };
    if (plan.label !== undefined) data.label = plan.label;
    if (plan.sortOrder !== undefined) data.sortOrder = plan.sortOrder;
    await prisma.formCategory.update({ where: { key }, data });
    console.log(
      `  - ${key}: active=${plan.active}` +
        (plan.label ? ` label="${plan.label}" sort=${plan.sortOrder}` : " (archived)")
    );
  }

  console.log("\n=== Updating Parent → Purpose options (Drop, Pickup) ===");
  const parent = await prisma.formCategory.findUnique({
    where: { key: "PARENT" },
    include: { fields: true },
  });
  if (!parent) {
    console.log("  Parent category not found — nothing else to do.");
    return;
  }

  const purpose = parent.fields.find((f) => f.name === "purpose");
  if (purpose) {
    await prisma.fieldOption.deleteMany({ where: { fieldId: purpose.id } });
    await prisma.fieldOption.createMany({
      data: [
        { fieldId: purpose.id, value: "Drop", label: "Drop", sortOrder: 0 },
        { fieldId: purpose.id, value: "Pickup", label: "Pickup", sortOrder: 1 },
      ],
    });
    // Keep it a required select.
    await prisma.formField.update({
      where: { id: purpose.id },
      data: { type: "select", required: true, label: "Purpose of Visit" },
    });
    console.log("  purpose options set to [Drop, Pickup]");
  } else {
    console.log("  purpose field not found (skipped)");
  }

  console.log("\n=== Updating Parent → Hostel (single letter) ===");
  const hostel = parent.fields.find((f) => f.name === "hostel");
  if (hostel) {
    await prisma.formField.update({
      where: { id: hostel.id },
      data: {
        pattern: "^[A-Za-z]$",
        maxLength: 1,
        placeholder: "e.g. A",
        // Preserve existing conditional-required behaviour (Pickup only).
        requiredWhenField: "purpose",
        requiredWhenValue: "Pickup",
      },
    });
    console.log("  hostel set to single-letter (pattern ^[A-Za-z]$, maxLength 1)");
  } else {
    console.log("  hostel field not found (skipped)");
  }

  console.log("\n=== Final active categories ===");
  const active = await prisma.formCategory.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { key: true, label: true, sortOrder: true },
  });
  for (const c of active) console.log(`  [${c.sortOrder}] ${c.key} → "${c.label}"`);

  console.log("\nDone.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
