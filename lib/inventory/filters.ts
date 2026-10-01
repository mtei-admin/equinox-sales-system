import type { InventoryAdjustmentStatus } from "@/types/database";
import { ilikeContains, orIlike } from "@/lib/master-data/filters";

export type InventoryAdjustmentListFilters = {
  q: string;
  status: "all" | InventoryAdjustmentStatus;
};

const ADJ_STATUSES: InventoryAdjustmentStatus[] = ["draft", "posted", "cancelled"];

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseAdjustmentListFilters(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): InventoryAdjustmentListFilters {
  const get = (key: string) =>
    searchParams instanceof URLSearchParams ? (searchParams.get(key) ?? "") : firstParam(searchParams[key]);
  const status = get("status");
  return {
    q: get("q").trim(),
    status: ADJ_STATUSES.includes(status as InventoryAdjustmentStatus)
      ? (status as InventoryAdjustmentStatus)
      : "all",
  };
}

export function hasAdjustmentFilters(filters: InventoryAdjustmentListFilters) {
  return filters.q.length > 0 || filters.status !== "all";
}

export function adjustmentSearchOr(pattern: string) {
  return orIlike(["adj_number", "remarks", "reason"], pattern);
}

export { ilikeContains };
