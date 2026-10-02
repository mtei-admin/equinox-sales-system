import { describe, expect, it } from "vitest";
import { accessForPath, canAccessPath, isPublicPath, safeNextPath } from "@/lib/auth/routes";
import { ALL_ROLES } from "@/lib/permissions/roles";
import type { UserRole } from "@/types/database";

const CASES: { path: string; allowed: UserRole[] }[] = [
  { path: "/dashboard", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/profile", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/users", allowed: ["admin"] },
  { path: "/users/abc", allowed: ["admin"] },
  { path: "/api/users/invite", allowed: ["admin"] },
  { path: "/api/users/reset-password", allowed: ["admin"] },
  { path: "/customers", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/customers/new", allowed: ["admin", "sales"] },
  { path: "/customers/abc/edit", allowed: ["admin", "sales"] },
  { path: "/customers/abc", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/items", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/items/new", allowed: ["admin", "sales"] },
  { path: "/items/abc/edit", allowed: ["admin", "sales"] },
  { path: "/sales-orders", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/sales-orders/new", allowed: ["admin", "sales"] },
  { path: "/sales-orders/abc/edit", allowed: ["admin", "sales"] },
  { path: "/sales-orders/abc", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/invoices", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/invoices/new", allowed: ["admin", "sales"] },
  { path: "/invoices/abc", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/invoices/abc/print", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/atw-dr", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/atw-dr/new", allowed: ["admin", "sales"] },
  { path: "/atw-dr/abc", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/atw-dr/abc/print", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/withdrawal-slips", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/withdrawal-slips/new", allowed: ["admin", "warehouse"] },
  { path: "/withdrawal-slips/abc", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/withdrawal-slips/abc/print", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/withdrawal-slips/abc/edit", allowed: ["admin", "warehouse"] },
  { path: "/inventory", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/inventory/adjustments", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/inventory/adjustments/new", allowed: ["admin", "warehouse"] },
  { path: "/inventory/adjustments/abc", allowed: ["admin", "sales", "warehouse", "accounting"] },
  { path: "/inventory/adjustments/abc/edit", allowed: ["admin", "warehouse"] },
  { path: "/reports", allowed: ["admin", "sales", "warehouse", "accounting"] },
];

describe("protected routes", () => {
  it("treats login and health as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/api/auth/sign-out")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(accessForPath("/login")).toBe("public");
  });

  it.each(CASES)("$path allows only the approved roles", ({ path, allowed }) => {
    for (const role of ALL_ROLES) {
      expect(canAccessPath(role, path)).toBe(allowed.includes(role));
    }
  });

  it("does not let /customers match a shorter prefix of /customer", () => {
    expect(accessForPath("/customers/new")).toBe("customers.write");
    expect(accessForPath("/customers/abc")).toBe("customers.read");
    expect(accessForPath("/customers/abc/edit")).toBe("customers.write");
    expect(accessForPath("/items/abc/edit")).toBe("items.write");
    expect(accessForPath("/sales-orders/abc/edit")).toBe("sales-orders.write");
    expect(accessForPath("/withdrawal-slips/abc/edit")).toBe("withdrawal-slips.write");
    expect(accessForPath("/users/abc")).toBe("users.manage");
  });
});

describe("safeNextPath", () => {
  it("allows in-app paths and rejects open redirects", () => {
    expect(safeNextPath("/profile")).toBe("/profile");
    expect(safeNextPath("/users")).toBe("/users");
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/login")).toBe("/dashboard");
  });
});
