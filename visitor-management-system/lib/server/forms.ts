import { prisma } from "@/lib/server/prisma";

// ---------------------------------------------------------------------------
// Dynamic form config loader + validator. Replaces the hardcoded lib/categories.ts
// as the runtime source of the intake form. HEAD manages the underlying rows.
// ---------------------------------------------------------------------------

export interface FormFieldConfig {
  id: string;
  name: string;
  label: string;
  type: string; // "text" | "tel" | "select" | "number"
  required: boolean;
  placeholder: string | null;
  pattern: string | null;
  maxLength: number | null;
  options: string[];
  requiredWhenField: string | null;
  requiredWhenValue: string | null;
}

export interface FormCategoryConfig {
  id: string;
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  fields: FormFieldConfig[];
}

const includeShape = {
  fields: {
    where: { active: true },
    orderBy: { sortOrder: "asc" as const },
    include: { options: { orderBy: { sortOrder: "asc" as const } } },
  },
};

function mapCategory(c: {
  id: string;
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  fields: Array<{
    id: string;
    name: string;
    label: string;
    type: string;
    required: boolean;
    placeholder: string | null;
    pattern: string | null;
    maxLength: number | null;
    requiredWhenField: string | null;
    requiredWhenValue: string | null;
    options: Array<{ value: string }>;
  }>;
}): FormCategoryConfig {
  return {
    id: c.id,
    key: c.key,
    label: c.label,
    description: c.description,
    icon: c.icon,
    fields: c.fields.map((f) => ({
      id: f.id,
      name: f.name,
      label: f.label,
      type: f.type,
      required: f.required,
      placeholder: f.placeholder,
      pattern: f.pattern,
      maxLength: f.maxLength,
      options: f.options.map((o) => o.value),
      requiredWhenField: f.requiredWhenField,
      requiredWhenValue: f.requiredWhenValue,
    })),
  };
}

/** All active categories (active fields, sorted) for the public intake form. */
export async function getFormConfig(): Promise<FormCategoryConfig[]> {
  const cats = await prisma.formCategory.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: includeShape,
  });
  return cats.map(mapCategory);
}

/** One active category by key (for server-side validation on submit). */
export async function getCategoryConfig(
  key: string
): Promise<FormCategoryConfig | null> {
  const c = await prisma.formCategory.findFirst({
    where: { key, active: true },
    include: includeShape,
  });
  return c ? mapCategory(c) : null;
}

export interface ValidationResult {
  ok: boolean;
  errors: Array<{ field: string; message: string }>;
  clean: Record<string, string>;
}

/**
 * Validate submitted values against a category's field config (required,
 * requiredWhen, select options, pattern, maxLength). Strips unknown keys.
 */
export function validateAgainstConfig(
  cat: FormCategoryConfig,
  values: Record<string, unknown>
): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const clean: Record<string, string> = {};

  for (const f of cat.fields) {
    const raw = values[f.name];
    const v = typeof raw === "string" ? raw.trim() : "";

    const conditionallyRequired =
      f.requiredWhenField != null &&
      String(values[f.requiredWhenField] ?? "").trim() === f.requiredWhenValue;
    const required = f.required || conditionallyRequired;

    if (!v) {
      if (required) errors.push({ field: f.name, message: "Required" });
      continue;
    }
    if (f.maxLength && v.length > f.maxLength) {
      errors.push({ field: f.name, message: "Too long" });
      continue;
    }
    if (f.type === "select" && f.options.length && !f.options.includes(v)) {
      errors.push({ field: f.name, message: "Invalid option" });
      continue;
    }
    if (f.pattern) {
      const src = f.pattern.startsWith("^") ? f.pattern : `^${f.pattern}$`;
      try {
        if (!new RegExp(src).test(v)) {
          errors.push({ field: f.name, message: "Check the format" });
          continue;
        }
      } catch {
        /* an invalid stored regex should never hard-fail a submission */
      }
    }
    clean[f.name] = v;
  }

  return { ok: errors.length === 0, errors, clean };
}

/** Ordered [{label,value}] snapshot for history-proof rendering on the record. */
export function buildFieldsSnapshot(
  cat: FormCategoryConfig,
  clean: Record<string, string>
): Array<{ label: string; value: string }> {
  return cat.fields
    .filter((f) => clean[f.name])
    .map((f) => ({ label: f.label, value: clean[f.name] }));
}
