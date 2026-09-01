import { describe, expect, it } from "vitest";
import { invoiceSchema } from "@/lib/validation/schemas";

const soId = "22222222-2222-4222-8222-222222222222";
const lineId = "11111111-1111-4111-8111-111111111111";

describe("invoice schema", () => {
  it("requires a typed invoice number, sales order, and at least one line", () => {
    const parsed = invoiceSchema.safeParse({
      sales_order_id: soId,
      invoice_number: "  BOOK-100  ",
      remarks: "",
      lines: [{ sales_order_item_id: lineId, quantity: "4", tax_amount: "10" }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.invoice_number).toBe("BOOK-100");
      expect(parsed.data.lines[0]?.quantity).toBe(4);
      expect(parsed.data.lines[0]?.tax_amount).toBe(10);
    }
  });

  it("rejects missing invoice number, empty lines, and non-positive qty", () => {
    expect(
      invoiceSchema.safeParse({
        sales_order_id: soId,
        invoice_number: " ",
        lines: [{ sales_order_item_id: lineId, quantity: 1 }],
      }).success,
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({
        sales_order_id: soId,
        invoice_number: "BOOK-1",
        lines: [],
      }).success,
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({
        sales_order_id: soId,
        invoice_number: "BOOK-1",
        lines: [{ sales_order_item_id: lineId, quantity: 0 }],
      }).success,
    ).toBe(false);
  });
});
