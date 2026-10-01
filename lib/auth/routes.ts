import { can, type Permission } from "@/lib/permissions/policies";
import type { UserRole } from "@/types/database";

export type RouteAccess = "public" | "authenticated" | Permission;

type RouteRule = {
  prefix: string;
  access: RouteAccess;
};

const ROUTE_RULES: RouteRule[] = [
  { prefix: "/login", access: "public" },
  { prefix: "/api/health", access: "public" },
  { prefix: "/api/auth/sign-out", access: "public" },
  { prefix: "/api/users/invite", access: "users.manage" },
  { prefix: "/api/users/reset-password", access: "users.manage" },
  { prefix: "/users", access: "users.manage" },
  { prefix: "/customers/new", access: "customers.write" },
  { prefix: "/customers", access: "customers.read" },
  { prefix: "/items/new", access: "items.write" },
  { prefix: "/items", access: "items.read" },
  { prefix: "/sales-orders/new", access: "sales-orders.write" },
  { prefix: "/sales-orders", access: "sales-orders.read" },
  { prefix: "/invoices/new", access: "invoices.write" },
  { prefix: "/invoices", access: "invoices.read" },
  { prefix: "/atw-dr/new", access: "atw-dr.write" },
  { prefix: "/atw-dr", access: "atw-dr.read" },
  { prefix: "/withdrawal-slips/new", access: "withdrawal-slips.write" },
  { prefix: "/withdrawal-slips", access: "withdrawal-slips.read" },
  { prefix: "/inventory/adjustments/new", access: "inventory.write" },
  { prefix: "/inventory/adjustments", access: "inventory.read" },
  { prefix: "/inventory", access: "inventory.read" },
  { prefix: "/reports", access: "reports.read" },
  { prefix: "/profile", access: "authenticated" },
  { prefix: "/dashboard", access: "authenticated" },
];

function pathMatches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string) {
  return accessForPath(pathname) === "public";
}

export function accessForPath(pathname: string): RouteAccess {
  if (/^\/customers\/[^/]+\/edit$/.test(pathname)) return "customers.write";
  if (/^\/items\/[^/]+\/edit$/.test(pathname)) return "items.write";
  if (/^\/sales-orders\/[^/]+\/edit$/.test(pathname)) return "sales-orders.write";
  if (/^\/withdrawal-slips\/[^/]+\/edit$/.test(pathname)) return "withdrawal-slips.write";
  if (/^\/inventory\/adjustments\/[^/]+\/edit$/.test(pathname)) return "inventory.write";
  if (/^\/users\/[^/]+$/.test(pathname)) return "users.manage";

  const match = [...ROUTE_RULES]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((rule) => pathMatches(pathname, rule.prefix));
  return match?.access ?? "authenticated";
}

export function canAccessPath(role: UserRole, pathname: string) {
  const access = accessForPath(pathname);
  if (access === "public" || access === "authenticated") return true;
  return can(role, access);
}

export function safeNextPath(value: string | null | undefined) {
  if (!value) return "/dashboard";
  if (!value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//")) return "/dashboard";
  if (value.startsWith("/login")) return "/dashboard";
  if (value.includes("://")) return "/dashboard";
  return value;
}

export { ROUTE_RULES };
