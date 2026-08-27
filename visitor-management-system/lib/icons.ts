import {
  Users,
  Truck,
  Car,
  HardHat,
  Landmark,
  IdCard,
  Home,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";
import type { VisitorCategory } from "./types";

// Maps each category to its Lucide icon component. Kept explicit (rather than a
// dynamic `Icons[name]` lookup) so only the icons we use land in the bundle.
export const CATEGORY_ICON: Record<VisitorCategory, LucideIcon> = {
  parent: Users,
  delivery_vendor: Truck,
  taxi: Car,
  contractor: HardHat,
  official: Landmark,
  staff: IdCard,
  resident: Home,
  others: CircleHelp,
};
