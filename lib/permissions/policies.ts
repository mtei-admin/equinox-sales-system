import type { ModuleKey, UserRole } from "@/types";

export type Permission =
  | "users.manage"
  | "customers.read"
  | "customers.write"
  | "items.read"
  | "items.write"
  | "sales-orders.read"
  | "sales-orders.write"
  | "invoices.read"
  | "invoices.write"
  | "atw-dr.read"
  | "atw-dr.write"
  | "withdrawal-slips.read"
  | "withdrawal-slips.write"
  | "reports.read";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "users.manage",
    "customers.read",
    "customers.write",
    "items.read",
    "items.write",
    "sales-orders.read",
    "sales-orders.write",
    "invoices.read",
    "invoices.write",
    "atw-dr.read",
    "atw-dr.write",
    "withdrawal-slips.read",
    "withdrawal-slips.write",
    "reports.read",
  ],
  sales: [
    "customers.read",
    "customers.write",
    "items.read",
    "items.write",
    "sales-orders.read",
    "sales-orders.write",
    "invoices.read",
    "invoices.write",
    "atw-dr.read",
    "atw-dr.write",
    "withdrawal-slips.read",
    "reports.read",
  ],
  warehouse: [
    "customers.read",
    "items.read",
    "sales-orders.read",
    "invoices.read",
    "atw-dr.read",
    "withdrawal-slips.read",
    "withdrawal-slips.write",
    "reports.read",
  ],
  accounting: [
    "customers.read",
    "items.read",
    "sales-orders.read",
    "invoices.read",
    "atw-dr.read",
    "withdrawal-slips.read",
    "reports.read",
  ],
};

export const ALL_PERMISSIONS: Permission[] = [
  "users.manage",
  "customers.read",
  "customers.write",
  "items.read",
  "items.write",
  "sales-orders.read",
  "sales-orders.write",
  "invoices.read",
  "invoices.write",
  "atw-dr.read",
  "atw-dr.write",
  "withdrawal-slips.read",
  "withdrawal-slips.write",
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
  return can(role, `${module}.read` as Permission);
}
