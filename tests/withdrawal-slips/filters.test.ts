import { describe, expect, it } from "vitest";
import {
  atwLookupOr,
  hasWithdrawalSlipFilters,
  parseWithdrawalSlipListFilters,
  withdrawalSlipSearchOr,
} from "@/lib/withdrawal-slips/filters";

describe("withdrawal slip list filters", () => {
  it("parses search and status", () => {
    expect(parseWithdrawalSlipListFilters({ q: "  WS-2026  ", status: "issued" })).toEqual({
      q: "WS-2026",
      status: "issued",
    });
    expect(parseWithdrawalSlipListFilters({ status: "posted" })).toEqual({
      q: "",
      status: "all",
    });
  });

  it("detects active filters and ATW lookup by id or number", () => {
    expect(hasWithdrawalSlipFilters({ q: "", status: "all" })).toBe(false);
    expect(hasWithdrawalSlipFilters({ q: "north", status: "all" })).toBe(true);
    expect(hasWithdrawalSlipFilters({ q: "", status: "draft" })).toBe(true);
    expect(withdrawalSlipSearchOr("%ws%")).toBe('ws_number.ilike."%ws%",customer_name.ilike."%ws%"');
    expect(atwLookupOr("ATW-2026-0001")).toBe('atw_number.ilike."%ATW-2026-0001%"');
    expect(atwLookupOr("11111111-1111-4111-8111-111111111111")).toContain(
      "id.eq.11111111-1111-4111-8111-111111111111",
    );
    expect(atwLookupOr("11111111-1111-4111-8111-111111111111")).toContain("atw_number.ilike.");
    expect(atwLookupOr("  ")).toBeNull();
  });
});
