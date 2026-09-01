import type { WsStatus } from "@/types/database";
import { ilikeContains, orIlike } from "@/lib/master-data/filters";
import { isUuid } from "@/lib/withdrawal-slips/eligibility";

export type WithdrawalSlipListFilters = {
  q: string;
  status: "all" | WsStatus;
};

const WS_STATUSES: WsStatus[] = ["draft", "issued", "cancelled"];

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseWithdrawalSlipListFilters(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): WithdrawalSlipListFilters {
  const get = (key: string) =>
    searchParams instanceof URLSearchParams ? (searchParams.get(key) ?? "") : firstParam(searchParams[key]);
  const status = get("status");
  return {
    q: get("q").trim(),
    status: WS_STATUSES.includes(status as WsStatus) ? (status as WsStatus) : "all",
  };
}

export function hasWithdrawalSlipFilters(filters: WithdrawalSlipListFilters) {
  return filters.q.length > 0 || filters.status !== "all";
}

export function withdrawalSlipSearchOr(pattern: string) {
  return orIlike(["ws_number", "customer_name"], pattern);
}

export function atwLookupOr(raw: string) {
  const q = raw.trim();
  if (!q) return null;
  const parts: string[] = [];
  if (isUuid(q)) parts.push(`id.eq.${q}`);
  const pattern = ilikeContains(q);
  if (pattern) parts.push(`atw_number.ilike."${pattern}"`);
  return parts.length > 0 ? parts.join(",") : null;
}

export { ilikeContains };
