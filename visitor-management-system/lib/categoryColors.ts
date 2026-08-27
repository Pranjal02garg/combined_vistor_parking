// ---------------------------------------------------------------------------
// Fixed category color palette for the guard portal, so a guard can tell a
// visitor's category at a glance by the whole card's color. Keyed by the stable
// category KEY (uppercase, as stored in VisitLog.category / FeedItem.category),
// plus "VIP".
//
// Class strings are written out in full (never composed dynamically) so
// Tailwind's JIT scanner keeps them in the build.
// ---------------------------------------------------------------------------

export interface CategoryColor {
  /** Badge classes. */
  badge: string;
  /** Whole-card background tint. */
  bg: string;
  /** Whole-card border color. */
  border: string;
}

const COLORS: Record<string, CategoryColor> = {
  // The four active categories.
  PARENT: { badge: "bg-emerald-200 text-emerald-800", bg: "bg-emerald-100", border: "border-emerald-500" },
  DELIVERY: { badge: "bg-amber-200 text-amber-800", bg: "bg-amber-100", border: "border-amber-500" },
  VENDOR: { badge: "bg-orange-200 text-orange-800", bg: "bg-orange-100", border: "border-orange-500" },
  DELIVERY_VENDOR: { badge: "bg-amber-200 text-amber-800", bg: "bg-amber-100", border: "border-amber-500" },
  STAFF: { badge: "bg-sky-200 text-sky-800", bg: "bg-sky-100", border: "border-sky-500" },
  GUEST: { badge: "bg-indigo-200 text-indigo-800", bg: "bg-indigo-100", border: "border-indigo-500" },
  HOUSE_HELP: { badge: "bg-purple-200 text-purple-800", bg: "bg-purple-100", border: "border-purple-500" },
  OTHERS: { badge: "bg-slate-300 text-slate-800", bg: "bg-slate-200", border: "border-slate-500" },
  // VIP / Official Guest passes keep purple/gold treatment.
  VIP: { badge: "bg-purple-200 text-purple-800", bg: "bg-purple-100", border: "border-purple-500" },
  // Archived categories can still appear on historical visits — give them
  // distinct colors so old records stay readable.
  TAXI: { badge: "bg-yellow-200 text-yellow-800", bg: "bg-yellow-100", border: "border-yellow-500" },
  CONTRACTOR: { badge: "bg-orange-200 text-orange-800", bg: "bg-orange-100", border: "border-orange-500" },
  OFFICIAL: { badge: "bg-indigo-200 text-indigo-800", bg: "bg-indigo-100", border: "border-indigo-500" },
  RESIDENT: { badge: "bg-teal-200 text-teal-800", bg: "bg-teal-100", border: "border-teal-500" },
};

// Deterministic fallback palette for any unmapped / future category key.
const FALLBACK: CategoryColor[] = [
  { badge: "bg-rose-200 text-rose-800", bg: "bg-rose-100", border: "border-rose-500" },
  { badge: "bg-cyan-200 text-cyan-800", bg: "bg-cyan-100", border: "border-cyan-500" },
  { badge: "bg-lime-200 text-lime-800", bg: "bg-lime-100", border: "border-lime-500" },
  { badge: "bg-fuchsia-200 text-fuchsia-800", bg: "bg-fuchsia-100", border: "border-fuchsia-500" },
];

/** Color set for a category key (or "VIP"). Stable per key. */
export function categoryColor(key: string | null | undefined): CategoryColor {
  if (!key) return COLORS.OTHERS;
  const upper = key.toUpperCase();
  if (COLORS[upper]) return COLORS[upper];
  // Hash the key into the fallback palette so the same key always maps the same.
  let h = 0;
  for (let i = 0; i < upper.length; i++) h = (h * 31 + upper.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
