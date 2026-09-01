import { describe, expect, it } from "vitest";
import {
  allocateSoLine,
  allocateSoLines,
  assertInvoiceAllocation,
  soFullyInvoiced,
  soHeaderRemaining,
  soItemInvoicedQty,
  soItemRemainingQty,
} from "@/lib/sales-orders/allocation";
import type { InvoiceQtyConsumption } from "@/lib/sales-orders/allocation";

const pipe = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const wire = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const soLines = [
  { id: pipe, quantity: 10 },
  { id: wire, quantity: 5 },
];

function invoices(rows: InvoiceQtyConsumption[]) {
  return rows;
}

describe("SO → invoice quantity allocation", () => {
  it("starts with remaining equal to the sales order quantity", () => {
    expect(allocateSoLine(10, 0)).toEqual({ ordered: 10, invoiced: 0, remaining: 10 });
    expect(soItemRemainingQty(10, pipe, [])).toBe(10);
  });

  it("subtracts only non-cancelled invoice quantities", () => {
    const rows = invoices([
      { sales_order_item_id: pipe, quantity: 6, invoice_status: "posted" },
      { sales_order_item_id: pipe, quantity: 4, invoice_status: "cancelled" },
      { sales_order_item_id: pipe, quantity: 1, invoice_status: "draft" },
    ]);
    expect(soItemInvoicedQty(pipe, rows)).toBe(7);
    expect(soItemRemainingQty(10, pipe, rows)).toBe(3);
  });

  it("allows multiple invoices against one SO line until remaining is 0", () => {
    const first: InvoiceQtyConsumption[] = [
      { sales_order_item_id: pipe, quantity: 6, invoice_status: "posted" },
    ];
    expect(soItemRemainingQty(10, pipe, first)).toBe(4);
    expect(() =>
      assertInvoiceAllocation(soLines, first, [{ sales_order_item_id: pipe, quantity: 4 }]),
    ).not.toThrow();

    const both: InvoiceQtyConsumption[] = [
      ...first,
      { sales_order_item_id: pipe, quantity: 4, invoice_status: "draft" },
    ];
    expect(soItemRemainingQty(10, pipe, both)).toBe(0);
    expect(soFullyInvoiced([{ id: pipe, quantity: 10 }], both)).toBe(true);
  });

  it("rejects an invoice quantity greater than remaining", () => {
    const existing: InvoiceQtyConsumption[] = [
      { sales_order_item_id: pipe, quantity: 8, invoice_status: "posted" },
    ];
    expect(() =>
      assertInvoiceAllocation(soLines, existing, [{ sales_order_item_id: pipe, quantity: 3 }]),
    ).toThrow(/exceeds remaining 2/);
  });

  it("does not let one line consume another line remaining", () => {
    const existing: InvoiceQtyConsumption[] = [
      { sales_order_item_id: pipe, quantity: 10, invoice_status: "posted" },
    ];
    expect(soItemRemainingQty(10, pipe, existing)).toBe(0);
    expect(soItemRemainingQty(5, wire, existing)).toBe(5);
    expect(() =>
      assertInvoiceAllocation(soLines, existing, [{ sales_order_item_id: wire, quantity: 5 }]),
    ).not.toThrow();
  });

  it("rejects an invoice line that is not on the sales order", () => {
    expect(() =>
      assertInvoiceAllocation(soLines, [], [
        { sales_order_item_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", quantity: 1 },
      ]),
    ).toThrow(/does not belong to the sales order/);
  });

  it("sums remaining across the header from per-line remaining", () => {
    const rows = invoices([
      { sales_order_item_id: pipe, quantity: 4, invoice_status: "posted" },
      { sales_order_item_id: wire, quantity: 2, invoice_status: "posted" },
    ]);
    expect(soHeaderRemaining(soLines, rows)).toBe(9);
    expect(allocateSoLines(soLines, rows)).toEqual([
      { sales_order_item_id: pipe, ordered: 10, invoiced: 4, remaining: 6 },
      { sales_order_item_id: wire, ordered: 5, invoiced: 2, remaining: 3 },
    ]);
    expect(soFullyInvoiced(soLines, rows)).toBe(false);
  });

  it("returns remaining to the SO when an invoice is cancelled", () => {
    const posted: InvoiceQtyConsumption[] = [
      { sales_order_item_id: pipe, quantity: 10, invoice_status: "posted" },
    ];
    expect(soItemRemainingQty(10, pipe, posted)).toBe(0);
    const cancelled = posted.map((row) => ({ ...row, invoice_status: "cancelled" as const }));
    expect(soItemRemainingQty(10, pipe, cancelled)).toBe(10);
  });
});
