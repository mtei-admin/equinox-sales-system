import { isUuid } from "@/lib/withdrawal-slips/eligibility";
import { ilikeContains } from "@/lib/master-data/filters";

export type ReportStatus =
  | "all"
  | "draft"
  | "open"
  | "closed"
  | "posted"
  | "released"
  | "issued"
  | "cancelled";

export type ReportFilters = {
  date_from: string;
  date_to: string;
  customer_id: string;
  sales_employee_id: string;
  number: string;
  status: ReportStatus;
};

const REPORT_STATUSES: ReportStatus[] = [
  "all",
  "draft",
  "open",
  "closed",
  "posted",
  "released",
  "issued",
  "cancelled",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseDate(raw: string) {
  const value = raw.trim();
  return ISO_DATE.test(value) ? value : "";
}

function parseUuid(raw: string) {
  const value = raw.trim();
  return isUuid(value) ? value : "";
}

export function parseReportFilters(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): ReportFilters {
  const get = (key: string) =>
    searchParams instanceof URLSearchParams ? (searchParams.get(key) ?? "") : firstParam(searchParams[key]);
  const status = get("status");
  const number = (get("number") || get("q")).trim();
  return {
    date_from: parseDate(get("date_from")),
    date_to: parseDate(get("date_to")),
    customer_id: parseUuid(get("customer_id")),
    sales_employee_id: parseUuid(get("sales_employee_id")),
    number,
    status: REPORT_STATUSES.includes(status as ReportStatus) ? (status as ReportStatus) : "all",
  };
}

export function hasReportFilters(filters: ReportFilters) {
  return (
    filters.date_from.length > 0 ||
    filters.date_to.length > 0 ||
    filters.customer_id.length > 0 ||
    filters.sales_employee_id.length > 0 ||
    filters.number.length > 0 ||
    filters.status !== "all"
  );
}

export const SO_REPORT_STATUSES = ["draft", "open", "closed", "cancelled"] as const;
export const INVOICE_REPORT_STATUSES = ["draft", "posted", "cancelled"] as const;
export const ATW_REPORT_STATUSES = ["draft", "released", "cancelled"] as const;
export const WS_REPORT_STATUSES = ["draft", "issued", "cancelled"] as const;

export function statusAppliesTo(filters: ReportFilters, allowed: readonly string[]) {
  return filters.status === "all" || allowed.includes(filters.status);
}

export function scopedRows<T>(rows: T[], filters: ReportFilters, allowed: readonly string[]) {
  return statusAppliesTo(filters, allowed) ? rows : [];
}

export type FilterableDocument = {
  order_date: string;
  customer_id: string;
  sales_employee_id: string | null;
  status: string;
  number: string;
};

export function matchesReportFilters(row: FilterableDocument, filters: ReportFilters) {
  if (filters.date_from && row.order_date < filters.date_from) return false;
  if (filters.date_to && row.order_date > filters.date_to) return false;
  if (filters.customer_id && row.customer_id !== filters.customer_id) return false;
  if (filters.sales_employee_id && row.sales_employee_id !== filters.sales_employee_id) return false;
  if (filters.status !== "all" && row.status !== filters.status) return false;
  if (filters.number) {
    const needle = filters.number.toLowerCase();
    if (!row.number.toLowerCase().includes(needle)) return false;
  }
  return true;
}

export { ilikeContains };
