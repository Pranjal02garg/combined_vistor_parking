// Core domain model for the visitor management prototype.
// No backend: these types describe the shapes we keep in React state.

export type VisitorCategory =
  | "parent"
  | "delivery_vendor" // merged: courier, food delivery and suppliers/vendors
  | "taxi"
  | "contractor"
  | "official"
  | "staff"
  | "resident"
  | "others";

export type VisitorStatus =
  | "pending" // submitted, waiting for a guard
  | "approved" // inside the campus
  | "rejected" // denied at the gate
  | "escalated" // flagged to a senior guard / supervisor
  | "exited"; // left through any gate

export type FieldType = "text" | "tel" | "select" | "number";

/** A single input in a category's dynamic form. `name` is the key in `fieldValues`. */
export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  /** Options for `type: "select"`. */
  options?: string[];
  /** Optional HTML validation pattern (e.g. a vehicle-number format). */
  pattern?: string;
  /** Maximum length for text inputs to prevent memory abuse. */
  maxLength?: number;
  /**
   * Makes an otherwise-optional field required only when another field holds a
   * specific value (e.g. Parent → Hostel is required only when Purpose = Pickup).
   */
  requiredWhen?: { field: string; value: string };
}

/** Everything the UI needs to render one category and its form. */
export interface CategoryConfig {
  id: VisitorCategory;
  label: string;
  /** Lucide icon name, resolved at render time. */
  icon: string;
  description: string;
  fields: FormField[];
}

/** A full visitor record produced on submission. */
export interface Visitor {
  id: string;
  /** Human-friendly reference shown to the visitor, e.g. "VMS-3F9K2". */
  referenceId: string;
  category: VisitorCategory;
  /** Answers keyed by `FormField.name`. */
  fieldValues: Record<string, string>;
  /** Base64 selfie data URL. */
  selfie: string;
  status: VisitorStatus;
  /** Gate the visitor entered through. */
  entryGate: string;
  /** Gate the visitor left through, once exited (cross-gate aware). */
  exitGate?: string;
  createdAt: number;
  /** When a guard approved entry (i.e. the actual "entered campus" time). */
  enteredAt?: number;
  /** Hoisted out of `fieldValues` so the guard queue can search fast. */
  phone: string;
  vehicleNumber?: string;
}

/** Trimmed view of a Visitor for rendering the guard queue list. */
export interface QueueItem {
  id: string;
  referenceId: string;
  name: string;
  category: VisitorCategory;
  phone: string;
  vehicleNumber?: string;
  entryGate: string;
  status: VisitorStatus;
  createdAt: number;
}
