import type { ModuleKey, UserRole } from "@/types";

export type Permission =
  | "users.manage"
  | "customers.read"
  | "customers.write"
  | "suppliers.read"
  | "suppliers.write"
  | "items.read"
  | "items.write"
  | "purchase-orders.read"
  | "purchase-orders.write"
  | "bills-of-lading.read"
  | "bills-of-lading.write"
  | "receiving-reports.read"
  | "receiving-reports.write"
  | "sales-orders.read"
  | "sales-orders.write"
  | "invoices.read"
  | "invoices.write"
  | "atw-dr.read"
  | "atw-dr.write"
  | "withdrawal-slips.read"
  | "withdrawal-slips.write"
  | "inventory.read"
  | "inventory.write"
  | "reports.read";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "users.manage",
    "customers.read",
    "customers.write",
    "suppliers.read",
    "suppliers.write",
    "items.read",
    "items.write",
    "purchase-orders.read",
    "purchase-orders.write",
    "bills-of-lading.read",
    "bills-of-lading.write",
    "receiving-reports.read",
    "receiving-reports.write",
    "sales-orders.read",
    "sales-orders.write",
    "invoices.read",
    "invoices.write",
    "atw-dr.read",
    "atw-dr.write",
    "withdrawal-slips.read",
    "withdrawal-slips.write",
    "inventory.read",
    "inventory.write",
    "reports.read",
  ],
  sales: [
    "customers.read",
    "customers.write",
    "suppliers.read",
    "items.read",
    "items.write",
    "purchase-orders.read",
    "bills-of-lading.read",
    "receiving-reports.read",
    "sales-orders.read",
    "sales-orders.write",
    "invoices.read",
    "invoices.write",
    "atw-dr.read",
    "atw-dr.write",
    "withdrawal-slips.read",
    "inventory.read",
    "reports.read",
  ],
  warehouse: [
    "customers.read",
    "suppliers.read",
    "items.read",
    "purchase-orders.read",
    "bills-of-lading.read",
    "bills-of-lading.write",
    "receiving-reports.read",
    "receiving-reports.write",
    "sales-orders.read",
    "invoices.read",
    "atw-dr.read",
    "withdrawal-slips.read",
    "withdrawal-slips.write",
    "inventory.read",
    "inventory.write",
    "reports.read",
  ],
  accounting: [
    "customers.read",
    "suppliers.read",
    "items.read",
    "purchase-orders.read",
    "bills-of-lading.read",
    "receiving-reports.read",
    "sales-orders.read",
    "invoices.read",
    "atw-dr.read",
    "withdrawal-slips.read",
    "inventory.read",
    "reports.read",
  ],
};

export const ALL_PERMISSIONS: Permission[] = [
  "users.manage",
  "customers.read",
  "customers.write",
  "suppliers.read",
  "suppliers.write",
  "items.read",
  "items.write",
  "purchase-orders.read",
  "purchase-orders.write",
  "bills-of-lading.read",
  "bills-of-lading.write",
  "receiving-reports.read",
  "receiving-reports.write",
  "sales-orders.read",
  "sales-orders.write",
  "invoices.read",
  "invoices.write",
  "atw-dr.read",
  "atw-dr.write",
  "withdrawal-slips.read",
  "withdrawal-slips.write",
  "inventory.read",
  "inventory.write",
  "reports.read",
];

export function permissionsFor(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function can(role: UserRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAccessModule(role: UserRole, module: ModuleKey) {
  if (module === "dashboard") return true;
  if (module === "users") return can(role, "users.manage");
  if (module === "reports") return can(role, "reports.read");
  if (module === "inventory") return can(role, "inventory.read");
  return can(role, `${module}.read` as Permission);
}
