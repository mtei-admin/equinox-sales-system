import { describe, expect, it } from "vitest";
import {
  hasReportFilters,
  matchesReportFilters,
  parseReportFilters,
  scopedRows,
  statusAppliesTo,
} from "@/lib/reports/filters";

const row = {
  order_date: "2026-09-01",
  customer_id: "11111111-1111-4111-8111-111111111111",
  sales_employee_id: "22222222-2222-4222-8222-222222222222",
  status: "open",
  number: "SO-2026-0004",
};

describe("report filters", () => {
  it("parses date, customer, document number, status, and sales employee", () => {
    expect(
      parseReportFilters({
        date_from: "2026-09-01",
        date_to: "2026-09-30",
        customer_id: row.customer_id,
        sales_employee_id: row.sales_employee_id,
        number: "  SO-2026  ",
        status: "open",
      }),
    ).toEqual({
      date_from: "2026-09-01",
      date_to: "2026-09-30",
      customer_id: row.customer_id,
      sales_employee_id: row.sales_employee_id,
      number: "SO-2026",
      status: "open",
    });
    expect(parseReportFilters({ date_from: "not-a-date", status: "packing", q: "INV-1" })).toEqual({
      date_from: "",
      date_to: "",
      customer_id: "",
      sales_employee_id: "",
      number: "INV-1",
      status: "all",
    });
  });

  it("matches and rejects rows by each filter", () => {
    const base = {
      date_from: "",
      date_to: "",
      customer_id: "",
      sales_employee_id: "",
      number: "",
      status: "all" as const,
    };
    expect(matchesReportFilters(row, base)).toBe(true);
    expect(matchesReportFilters(row, { ...base, date_from: "2026-09-02" })).toBe(false);
    expect(matchesReportFilters(row, { ...base, date_to: "2026-08-31" })).toBe(false);
    expect(matchesReportFilters(row, { ...base, customer_id: "33333333-3333-4333-8333-333333333333" })).toBe(false);
    expect(matchesReportFilters(row, { ...base, number: "so-2026-0004" })).toBe(true);
    expect(matchesReportFilters(row, { ...base, status: "posted" })).toBe(false);
    expect(hasReportFilters(base)).toBe(false);
    expect(hasReportFilters({ ...base, number: "SO" })).toBe(true);
    expect(statusAppliesTo({ ...base, status: "posted" }, ["draft", "posted", "cancelled"])).toBe(true);
    expect(statusAppliesTo({ ...base, status: "posted" }, ["draft", "open", "closed", "cancelled"])).toBe(false);
    expect(scopedRows([row], { ...base, status: "posted" }, ["draft", "open", "closed", "cancelled"])).toEqual([]);
    expect(scopedRows([row], { ...base, status: "open" }, ["draft", "open", "closed", "cancelled"])).toEqual([row]);
  });
});
