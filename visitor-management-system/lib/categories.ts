import type { CategoryConfig, FormField, VisitorCategory } from "./types";

// Fields shared by every category. Spread into each config so the form always
// asks for a name and a reachable phone number.
const BASE_FIELDS: FormField[] = [
  {
    name: "name",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "As on your ID",
    maxLength: 60,
    pattern: "^[a-zA-Z\\s\\.]{2,60}$", // Letters, spaces, and dots only
  },
  {
    name: "phone",
    label: "Phone Number",
    type: "tel",
    required: true,
    placeholder: "10-digit mobile",
    pattern: "^[0-9]{10}$", // Exactly 10 digits
    maxLength: 10,
  },
];

// A reusable optional vehicle field for categories where it may or may not apply.
const VEHICLE_OPTIONAL: FormField = {
  name: "vehicleNumber",
  label: "Vehicle Number",
  type: "text",
  required: false,
  placeholder: "Optional — e.g. PB10AB1234",
  maxLength: 15,
  pattern: "^[a-zA-Z0-9\\s-]{4,15}$", // Letters, numbers, hyphens, spaces
};

export const CATEGORIES: CategoryConfig[] = [
  {
    id: "parent",
    label: "Parent",
    icon: "Users",
    description: "Visiting a student",
    fields: [
      ...BASE_FIELDS,
      {
        name: "studentName",
        label: "Student Name",
        type: "text",
        required: true,
        placeholder: "Student you're visiting",
        maxLength: 60,
        pattern: "^[a-zA-Z\\s\\.]{2,60}$",
      },
      {
        name: "purpose",
        label: "Purpose of Visit",
        type: "select",
        required: true,
        options: ["Drop", "Pickup"],
      },
      {
        name: "hostel",
        label: "Hostel Name",
        type: "text",
        // Only mandatory for pickups; optional for drops.
        required: false,
        requiredWhen: { field: "purpose", value: "Pickup" },
        // Hostels are identified by a single letter (e.g. A, B, C).
        placeholder: "e.g. A",
        maxLength: 1,
        pattern: "^[A-Za-z]$",
      },
      {
        name: "vehicleNumber",
        label: "Vehicle Number",
        type: "text",
        required: false,
        placeholder: "e.g. PB10AB1234",
        maxLength: 15,
        pattern: "^[a-zA-Z0-9\\s-]{4,15}$",
      },
    ],
  },
  {
    id: "delivery_vendor",
    label: "Delivery & Vendor",
    icon: "Truck",
    description: "24-Hr Day Pass: Swiggy, Zomato, Amazon, Blinkit, Vendors",
    fields: [
      ...BASE_FIELDS,
      {
        name: "company",
        label: "Company / Service",
        type: "select",
        required: true,
        options: [
          "Swiggy",
          "Zomato",
          "Amazon",
          "Blinkit",
          "Zepto",
          "Flipkart",
          "Uber / Rapido",
          "Porter / Courier",
          "Campus Vendor / Maintenance",
          "Other",
        ],
      },
      {
        name: "purpose",
        label: "Purpose",
        type: "select",
        required: true,
        options: [
          "Food Delivery",
          "Parcel / Courier",
          "Grocery",
          "Supplier / Vendor",
          "Service / Maintenance",
          "Other",
        ],
      },
      {
        name: "deliverTo",
        label: "Delivery To / Person to Meet",
        type: "text",
        required: true,
        placeholder: "Hostel, department or person",
        maxLength: 60,
        pattern: "^[a-zA-Z0-9\\s\\.-]{2,60}$",
      },
      VEHICLE_OPTIONAL,
    ],
  },
  {
    id: "staff",
    label: "Staff",
    icon: "IdCard",
    description: "University employee",
    fields: [
      ...BASE_FIELDS,
      {
        name: "employeeId",
        label: "Employee ID",
        type: "text",
        required: true,
        placeholder: "Your staff ID",
        maxLength: 20,
        pattern: "^[a-zA-Z0-9-]{3,20}$",
      },
      {
        name: "department",
        label: "Department",
        type: "text",
        required: true,
        placeholder: "e.g. Civil Engg.",
        maxLength: 50,
        pattern: "^[a-zA-Z0-9\\s-]{2,50}$",
      },
      VEHICLE_OPTIONAL,
    ],
  },
  {
    id: "others",
    label: "Other",
    icon: "CircleHelp",
    description: "Any other visit",
    fields: [
      ...BASE_FIELDS,
      {
        name: "purpose",
        label: "Purpose of Visit",
        type: "text",
        required: true,
        placeholder: "Reason for your visit",
        maxLength: 80,
        pattern: "^[a-zA-Z0-9\\s\\.,-]{2,80}$",
      },
      {
        name: "meetPerson",
        label: "Person / Place to Meet",
        type: "text",
        required: true,
        placeholder: "Who or where on campus",
        maxLength: 60,
        pattern: "^[a-zA-Z0-9\\s\\.-]{2,60}$",
      },
      VEHICLE_OPTIONAL,
    ],
  },
];

/** Look up a category config by id. Returns undefined for unknown ids. */
export function getCategory(id: VisitorCategory): CategoryConfig | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
