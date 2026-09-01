import type { UserRole } from "@/types/database";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  sales: "Sales",
  warehouse: "Warehouse",
  accounting: "Accounting",
};

export const ALL_ROLES: UserRole[] = ["admin", "sales", "warehouse", "accounting"];
