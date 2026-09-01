import type { InvoiceStatus } from "@/types/database";
import { ilikeContains, orIlike } from "@/lib/master-data/filters";

export type InvoiceListFilters = {
  q: string;
  status: "all" | InvoiceStatus;
};

const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "posted", "cancelled"];

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseInvoiceListFilters(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): InvoiceListFilters {
  const get = (key: string) =>
    searchParams instanceof URLSearchParams ? (searchParams.get(key) ?? "") : firstParam(searchParams[key]);
  const status = get("status");
  return {
    q: get("q").trim(),
    status: INVOICE_STATUSES.includes(status as InvoiceStatus) ? (status as InvoiceStatus) : "all",
  };
}

export function hasInvoiceFilters(filters: InvoiceListFilters) {
  return filters.q.length > 0 || filters.status !== "all";
}

export function invoiceSearchOr(pattern: string) {
  return orIlike(["invoice_number", "customer_name"], pattern);
}

export { ilikeContains };
