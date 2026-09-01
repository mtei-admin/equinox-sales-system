import { describe, expect, it } from "vitest";
import { cancelDocumentSchema, salesOrderSchema, updateSalesOrderSchema } from "@/lib/validation/schemas";

const itemId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";

describe("sales order schemas", () => {
  it("accepts a draft payload with quantity, price, and at least one line", () => {
    const parsed = salesOrderSchema.safeParse({
      customer_id: customerId,
      delivery_address: "123 Port Area",
      order_date: "2026-09-01",
      term: "30 days",
      reference_no: "PO-9",
      order_type: "regular",
      remarks: "Rush",
      lines: [{ item_id: itemId, quantity: "2", unit_price: "150.5", uom: "PCS" }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.lines[0]?.quantity).toBe(2);
      expect(parsed.data.lines[0]?.unit_price).toBe(150.5);
    }
  });

  it("rejects missing customer, empty lines, zero qty, and negative price", () => {
    expect(salesOrderSchema.safeParse({ order_date: "2026-09-01", lines: [] }).success).toBe(false);
    expect(
      salesOrderSchema.safeParse({
        customer_id: customerId,
        order_date: "2026-09-01",
        lines: [{ item_id: itemId, quantity: 0, unit_price: 1 }],
      }).success,
    ).toBe(false);
    expect(
      salesOrderSchema.safeParse({
        customer_id: customerId,
        order_date: "2026-09-01",
        lines: [{ item_id: itemId, quantity: 1, unit_price: -1 }],
      }).success,
    ).toBe(false);
  });

  it("requires a uuid id when updating", () => {
    const base = {
      customer_id: customerId,
      order_date: "2026-09-01",
      lines: [{ item_id: itemId, quantity: 1, unit_price: 10 }],
    };
    expect(updateSalesOrderSchema.safeParse(base).success).toBe(false);
    expect(updateSalesOrderSchema.safeParse({ ...base, id: customerId }).success).toBe(true);
  });

  it("requires a cancellation reason", () => {
    expect(cancelDocumentSchema.safeParse({ id: customerId, reason: "  " }).success).toBe(false);
    expect(cancelDocumentSchema.safeParse({ id: customerId, reason: "Customer withdrew" }).success).toBe(true);
  });
});
