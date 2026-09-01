import type { MasterStatus, UserRole } from "@/types/database";

export type MasterListFilters = {
  q: string;
  status: "all" | MasterStatus;
};

export type UserListFilters = MasterListFilters & {
  role: "all" | UserRole;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseMasterListFilters(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): MasterListFilters {
  const get = (key: string) =>
    searchParams instanceof URLSearchParams ? (searchParams.get(key) ?? "") : firstParam(searchParams[key]);
  const status = get("status");
  return {
    q: get("q").trim(),
    status: status === "active" || status === "inactive" ? status : "all",
  };
}

export function parseUserListFilters(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): UserListFilters {
  const base = parseMasterListFilters(searchParams);
  const get = (key: string) =>
    searchParams instanceof URLSearchParams ? (searchParams.get(key) ?? "") : firstParam(searchParams[key]);
  const role = get("role");
  const allowed: UserRole[] = ["admin", "sales", "warehouse", "accounting"];
  return {
    ...base,
    role: allowed.includes(role as UserRole) ? (role as UserRole) : "all",
  };
}

export function ilikeContains(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const escaped = trimmed
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .replaceAll(",", " ")
    .replaceAll('"', "");
  return `%${escaped}%`;
}

export function orIlike(columns: string[], pattern: string) {
  const quoted = `"${pattern}"`;
  return columns.map((column) => `${column}.ilike.${quoted}`).join(",");
}

export function hasActiveFilters(filters: MasterListFilters | UserListFilters) {
  if (filters.q.length > 0 || filters.status !== "all") return true;
  return "role" in filters && filters.role !== "all";
}
