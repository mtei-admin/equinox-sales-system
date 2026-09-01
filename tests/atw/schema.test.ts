import { describe, expect, it } from "vitest";
import { atwSchema } from "@/lib/validation/schemas";

const invoiceId = "22222222-2222-4222-8222-222222222222";
const lineId = "11111111-1111-4111-8111-111111111111";

describe("ATW/DR schema", () => {
  it("accepts ATW and DR with at least one line", () => {
    const atw = atwSchema.safeParse({
      invoice_id: invoiceId,
      document_type: "atw",
      lines: [{ invoice_item_id: lineId, quantity: "4" }],
    });
    expect(atw.success).toBe(true);
    const dr = atwSchema.safeParse({
      invoice_id: invoiceId,
      document_type: "dr",
      remarks: "Gate 2",
      lines: [{ invoice_item_id: lineId, quantity: 1 }],
    });
    expect(dr.success).toBe(true);
  });

  it("rejects missing invoice, empty lines, invalid type, and non-positive qty", () => {
    expect(atwSchema.safeParse({ document_type: "atw", lines: [{ invoice_item_id: lineId, quantity: 1 }] }).success).toBe(
      false,
    );
    expect(
      atwSchema.safeParse({ invoice_id: invoiceId, document_type: "atw", lines: [] }).success,
    ).toBe(false);
    expect(
      atwSchema.safeParse({
        invoice_id: invoiceId,
        document_type: "packing",
        lines: [{ invoice_item_id: lineId, quantity: 1 }],
      }).success,
    ).toBe(false);
    expect(
      atwSchema.safeParse({
        invoice_id: invoiceId,
        document_type: "dr",
        lines: [{ invoice_item_id: lineId, quantity: 0 }],
      }).success,
    ).toBe(false);
  });
});
