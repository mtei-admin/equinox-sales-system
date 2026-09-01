import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, can, canAccessModule, permissionsFor, type Permission } from "@/lib/permissions/policies";
import { ALL_ROLES } from "@/lib/permissions/roles";
import type { UserRole } from "@/types/database";
import type { ModuleKey } from "@/types";

const WRITES: Permission[] = [
  "users.manage",
  "customers.write",
  "items.write",
  "sales-orders.write",
  "invoices.write",
  "atw-dr.write",
  "withdrawal-slips.write",
];

const EXPECTED: Record<UserRole, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  sales: ALL_PERMISSIONS.filter((p) => p !== "users.manage" && p !== "withdrawal-slips.write"),
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

describe("role permission matrix", () => {
  it.each(ALL_ROLES)("%s matches the approved permission set", (role) => {
    expect([...permissionsFor(role)].sort()).toEqual([...EXPECTED[role]].sort());
    for (const permission of ALL_PERMISSIONS) {
      expect(can(role, permission)).toBe(EXPECTED[role].includes(permission));
    }
  });

  it("admin can do every action including users.manage", () => {
    expect(WRITES.every((permission) => can("admin", permission))).toBe(true);
    expect(canAccessModule("admin", "users")).toBe(true);
  });

  it("sales writes SO, invoice, and ATW but not withdrawal slips or users", () => {
    expect(can("sales", "sales-orders.write")).toBe(true);
    expect(can("sales", "invoices.write")).toBe(true);
    expect(can("sales", "atw-dr.write")).toBe(true);
    expect(can("sales", "customers.write")).toBe(true);
    expect(can("sales", "items.write")).toBe(true);
    expect(can("sales", "withdrawal-slips.write")).toBe(false);
    expect(can("sales", "users.manage")).toBe(false);
    expect(canAccessModule("sales", "users")).toBe(false);
  });

  it("warehouse writes withdrawal slips only", () => {
    expect(can("warehouse", "withdrawal-slips.write")).toBe(true);
    expect(can("warehouse", "sales-orders.write")).toBe(false);
    expect(can("warehouse", "invoices.write")).toBe(false);
    expect(can("warehouse", "atw-dr.write")).toBe(false);
    expect(can("warehouse", "customers.write")).toBe(false);
    expect(can("warehouse", "items.write")).toBe(false);
    expect(can("warehouse", "users.manage")).toBe(false);
    expect(canAccessModule("warehouse", "users")).toBe(false);
    expect(canAccessModule("warehouse", "withdrawal-slips")).toBe(true);
  });

  it("accounting is view-only and cannot open Users admin", () => {
    expect(WRITES.every((permission) => can("accounting", permission) === false)).toBe(true);
    expect(canAccessModule("accounting", "users")).toBe(false);
    expect(canAccessModule("accounting", "reports")).toBe(true);
    expect(canAccessModule("accounting", "sales-orders")).toBe(true);
  });

  it("every authenticated role can open dashboard", () => {
    const dashboard: ModuleKey = "dashboard";
    for (const role of ALL_ROLES) {
      expect(canAccessModule(role, dashboard)).toBe(true);
    }
  });
});
