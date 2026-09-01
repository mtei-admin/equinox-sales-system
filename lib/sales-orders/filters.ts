import type { SoStatus } from "@/types/database";
import { ilikeContains, orIlike } from "@/lib/master-data/filters";

export type SalesOrderListFilters = {
  q: string;
  status: "all" | SoStatus;
};

const SO_STATUSES: SoStatus[] = ["draft", "open", "closed", "cancelled"];

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseSalesOrderListFilters(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): SalesOrderListFilters {
  const get = (key: string) =>
    searchParams instanceof URLSearchParams ? (searchParams.get(key) ?? "") : firstParam(searchParams[key]);
  const status = get("status");
  return {
    q: get("q").trim(),
    status: SO_STATUSES.includes(status as SoStatus) ? (status as SoStatus) : "all",
  };
}

export function hasSalesOrderFilters(filters: SalesOrderListFilters) {
  return filters.q.length > 0 || filters.status !== "all";
}

export function salesOrderSearchOr(pattern: string) {
  return orIlike(["so_number", "customer_name", "reference_no"], pattern);
}

export { ilikeContains };
