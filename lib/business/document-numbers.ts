import type { DocumentKind } from "@/types";

const PREFIX: Record<DocumentKind, string> = {
  customer: "CUST-",
  sales_order: "SO-",
  invoice: "INV-",
  atw_dr: "ATW-",
  withdrawal_slip: "WS-",
};

export function formatDocumentNumber(kind: DocumentKind, year: number, sequence: number) {
  if (!Number.isInteger(year) || year < 2000) {
    throw new Error("Invalid year");
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Sequence must be a positive integer");
  }
  return `${PREFIX[kind]}${year}-${String(sequence).padStart(4, "0")}`;
}

export function parseDocumentNumber(value: string) {
  const match = value.match(/^(CUST|SO|INV|ATW|WS)-(\d{4})-(\d{4})$/);
  if (!match) return null;
  return { prefix: match[1], year: Number(match[2]), sequence: Number(match[3]) };
}
