import { describe, expect, it } from "vitest";
import { atwSearchOr, hasAtwFilters, parseAtwListFilters } from "@/lib/atw/filters";

describe("ATW/DR list filters", () => {
  it("parses search, status, and document type", () => {
    expect(parseAtwListFilters({ q: "  ATW-2026  ", status: "released", document_type: "dr" })).toEqual({
      q: "ATW-2026",
      status: "released",
      document_type: "dr",
    });
    expect(parseAtwListFilters({ status: "posted", document_type: "packing" })).toEqual({
      q: "",
      status: "all",
      document_type: "all",
    });
  });

  it("detects active filters", () => {
    expect(hasAtwFilters({ q: "", status: "all", document_type: "all" })).toBe(false);
    expect(hasAtwFilters({ q: "north", status: "all", document_type: "all" })).toBe(true);
    expect(hasAtwFilters({ q: "", status: "draft", document_type: "all" })).toBe(true);
    expect(hasAtwFilters({ q: "", status: "all", document_type: "atw" })).toBe(true);
    expect(atwSearchOr("%atw%")).toBe('atw_number.ilike."%atw%",customer_name.ilike."%atw%"');
  });
});
