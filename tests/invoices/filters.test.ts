import { describe, expect, it } from "vitest";
import { hasInvoiceFilters, invoiceSearchOr, parseInvoiceListFilters } from "@/lib/invoices/filters";

describe("invoice list filters", () => {
  it("parses search and invoice status", () => {
    expect(parseInvoiceListFilters({ q: "  BOOK-1  ", status: "posted" })).toEqual({
      q: "BOOK-1",
      status: "posted",
    });
    expect(parseInvoiceListFilters({ status: "open" })).toEqual({ q: "", status: "all" });
    expect(parseInvoiceListFilters({ status: ["cancelled"] }).status).toBe("cancelled");
  });

  it("detects active filters", () => {
    expect(hasInvoiceFilters({ q: "", status: "all" })).toBe(false);
    expect(hasInvoiceFilters({ q: "north", status: "all" })).toBe(true);
    expect(hasInvoiceFilters({ q: "", status: "draft" })).toBe(true);
    expect(invoiceSearchOr("%book%")).toBe('invoice_number.ilike."%book%",customer_name.ilike."%book%"');
  });
});
