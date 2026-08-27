/**
 * Categories that enforce stay duration limits (120 mins).
 * All other visitor categories (Parents, Guests, Staff Invites, Contractors, Residents) have unlimited stay.
 */
export const LIMITED_DURATION_CATEGORIES = new Set(["DELIVERY", "VENDOR"]);
export const DEFAULT_DAYPASS_DURATION_LIMIT = 120; // 120 minutes (2 hours)

/**
 * Checks if a specific category has an overstay limit.
 */
export function isOverstayTracked(category?: string | null): boolean {
  if (!category) return false;
  return LIMITED_DURATION_CATEGORIES.has(category.toUpperCase());
}

/**
 * Calculates the number of minutes a visitor has spent on campus since entry.
 */
export function minutesInside(
  enteredAt: Date | null | string,
  endTime: Date | null | string | number = Date.now()
): number {
  if (!enteredAt) return 0;
  const entryTime = new Date(enteredAt).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const diffMs = end - entryTime;
  return Math.max(0, Math.floor(diffMs / (1000 * 60)));
}

/**
 * Checks if a visitor's duration on campus exceeds the permitted limit in minutes.
 * Only applies to Delivery and Vendor categories (120 minutes limit).
 */
export function isOverstaying(
  enteredAt: Date | null | string,
  limitMinutes: number = DEFAULT_DAYPASS_DURATION_LIMIT,
  category?: string | null
): boolean {
  if (!enteredAt) return false;
  if (category && !isOverstayTracked(category)) {
    return false;
  }
  return minutesInside(enteredAt) > (limitMinutes || DEFAULT_DAYPASS_DURATION_LIMIT);
}
