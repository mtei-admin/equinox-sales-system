import { describe, expect, it } from "vitest";
import { hasSalesOrderFilters, parseSalesOrderListFilters, salesOrderSearchOr } from "@/lib/sales-orders/filters";

describe("sales order list filters", () => {
  it("parses search and document status", () => {
    expect(parseSalesOrderListFilters({ q: "  SO-2026  ", status: "open" })).toEqual({
      q: "SO-2026",
      status: "open",
    });
    expect(parseSalesOrderListFilters({ status: "active" })).toEqual({ q: "", status: "all" });
    expect(parseSalesOrderListFilters({ status: ["cancelled"] }).status).toBe("cancelled");
  });

  it("detects active filters and builds the search clause", () => {
    expect(hasSalesOrderFilters({ q: "", status: "all" })).toBe(false);
    expect(hasSalesOrderFilters({ q: "north", status: "all" })).toBe(true);
    expect(hasSalesOrderFilters({ q: "", status: "draft" })).toBe(true);
    expect(salesOrderSearchOr("%pipe%")).toBe(
      'so_number.ilike."%pipe%",customer_name.ilike."%pipe%",reference_no.ilike."%pipe%"',
    );
  });
});
