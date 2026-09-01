import { describe, expect, it } from "vitest";
import { formatDocumentNumber, parseDocumentNumber } from "@/lib/business/document-numbers";

describe("formatDocumentNumber", () => {
  it("formats a sales order number", () => {
    expect(formatDocumentNumber("sales_order", 2026, 1)).toBe("SO-2026-0001");
  });

  it("formats ATW and withdrawal numbers", () => {
    expect(formatDocumentNumber("atw_dr", 2026, 12)).toBe("ATW-2026-0012");
    expect(formatDocumentNumber("withdrawal_slip", 2026, 99)).toBe("WS-2026-0099");
  });

  it("rejects invalid sequences", () => {
    expect(() => formatDocumentNumber("invoice", 2026, 0)).toThrow();
  });
});

describe("parseDocumentNumber", () => {
  it("parses a valid number", () => {
    expect(parseDocumentNumber("INV-2026-0042")).toEqual({
      prefix: "INV",
      year: 2026,
      sequence: 42,
    });
  });

  it("returns null for garbage", () => {
    expect(parseDocumentNumber("INV-42")).toBeNull();
  });
});
