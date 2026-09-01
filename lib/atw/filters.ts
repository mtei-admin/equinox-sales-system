import type { AtwDocumentType, AtwStatus } from "@/types/database";
import { ilikeContains, orIlike } from "@/lib/master-data/filters";

export type AtwListFilters = {
  q: string;
  status: "all" | AtwStatus;
  document_type: "all" | AtwDocumentType;
};

const ATW_STATUSES: AtwStatus[] = ["draft", "released", "cancelled"];
const ATW_TYPES: AtwDocumentType[] = ["atw", "dr"];

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseAtwListFilters(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): AtwListFilters {
  const get = (key: string) =>
    searchParams instanceof URLSearchParams ? (searchParams.get(key) ?? "") : firstParam(searchParams[key]);
  const status = get("status");
  const documentType = get("document_type");
  return {
    q: get("q").trim(),
    status: ATW_STATUSES.includes(status as AtwStatus) ? (status as AtwStatus) : "all",
    document_type: ATW_TYPES.includes(documentType as AtwDocumentType) ? (documentType as AtwDocumentType) : "all",
  };
}

export function hasAtwFilters(filters: AtwListFilters) {
  return filters.q.length > 0 || filters.status !== "all" || filters.document_type !== "all";
}

export function atwSearchOr(pattern: string) {
  return orIlike(["atw_number", "customer_name"], pattern);
}

export { ilikeContains };
