import { describe, expect, it } from "vitest";
import { assertQtyWithinRemaining, consumedQty, remainingQty } from "@/lib/business/remaining";
import { headerTotals, invoiceLineTotals, soLineTotals } from "@/lib/business/totals";

describe("remaining quantity", () => {
  it("subtracts non-cancelled invoices from the SO item", () => {
    const consumed = consumedQty([
      { quantity: 6, cancelled: false },
      { quantity: 4, cancelled: true },
    ]);
    expect(consumed).toBe(6);
    expect(remainingQty(10, consumed)).toBe(4);
  });

  it("rejects invoice qty above remaining", () => {
    expect(() => assertQtyWithinRemaining(10, 8, 3, "Invoice")).toThrow(/exceeds remaining/);
    expect(() => assertQtyWithinRemaining(10, 8, 2, "Invoice")).not.toThrow();
  });
});

describe("totals", () => {
  it("computes SO amount with no tax", () => {
    expect(soLineTotals(10, 100)).toEqual({ amount: 1000, total_amount: 1000 });
  });

  it("adds typed tax on invoice lines", () => {
    expect(invoiceLineTotals(2, 50, 10)).toEqual({ amount: 100, tax_amount: 10, total_amount: 110 });
  });

  it("sums header totals from lines", () => {
    expect(headerTotals([
      { quantity: 2, total_amount: 110 },
      { quantity: 1, total_amount: 50 },
    ])).toEqual({ total_quantity: 3, grand_total: 160 });
  });
});
