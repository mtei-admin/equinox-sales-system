import { describe, expect, it } from "vitest";
import {
  assertCanCreateInvoice,
  eligibleSoLinesForInvoice,
  soFullyInvoiced,
  soHeaderRemaining,
  soItemRemainingQty,
  type InvoiceQtyConsumption,
} from "@/lib/sales-orders/allocation";

const pipe = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const wire = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const soLines = [
  { id: pipe, quantity: 10 },
  { id: wire, quantity: 5 },
];

describe("invoice from sales order", () => {
  it("copies only lines that still have remaining quantity", () => {
    const existing: InvoiceQtyConsumption[] = [
      { sales_order_item_id: pipe, quantity: 10, invoice_status: "posted" },
    ];
    expect(eligibleSoLinesForInvoice(soLines, existing)).toEqual([
      { sales_order_item_id: wire, ordered: 5, invoiced: 0, remaining: 5 },
    ]);
  });

  it("full invoice consumes all remaining on the selected lines", () => {
    expect(() =>
      assertCanCreateInvoice("open", soLines, [], [
        { sales_order_item_id: pipe, quantity: 10 },
        { sales_order_item_id: wire, quantity: 5 },
      ]),
    ).not.toThrow();
    const after: InvoiceQtyConsumption[] = [
      { sales_order_item_id: pipe, quantity: 10, invoice_status: "draft" },
      { sales_order_item_id: wire, quantity: 5, invoice_status: "draft" },
    ];
    expect(soHeaderRemaining(soLines, after)).toBe(0);
    expect(soFullyInvoiced(soLines, after)).toBe(true);
  });

  it("partial invoice leaves remaining for later invoices", () => {
    expect(() =>
      assertCanCreateInvoice("open", soLines, [], [{ sales_order_item_id: pipe, quantity: 4 }]),
    ).not.toThrow();
    const after: InvoiceQtyConsumption[] = [
      { sales_order_item_id: pipe, quantity: 4, invoice_status: "posted" },
    ];
    expect(soItemRemainingQty(10, pipe, after)).toBe(6);
    expect(soItemRemainingQty(5, wire, after)).toBe(5);
    expect(soFullyInvoiced(soLines, after)).toBe(false);
  });

  it("allows multiple invoices against one sales order until remaining is 0", () => {
    const first: InvoiceQtyConsumption[] = [
      { sales_order_item_id: pipe, quantity: 6, invoice_status: "posted" },
    ];
    expect(() =>
      assertCanCreateInvoice("open", soLines, first, [{ sales_order_item_id: pipe, quantity: 4 }]),
    ).not.toThrow();
    const both: InvoiceQtyConsumption[] = [
      ...first,
      { sales_order_item_id: pipe, quantity: 4, invoice_status: "draft" },
    ];
    expect(soItemRemainingQty(10, pipe, both)).toBe(0);
    expect(() =>
      assertCanCreateInvoice("open", soLines, both, [{ sales_order_item_id: wire, quantity: 5 }]),
    ).not.toThrow();
  });

  it("rejects over-invoicing above remaining quantity", () => {
    const existing: InvoiceQtyConsumption[] = [
      { sales_order_item_id: pipe, quantity: 8, invoice_status: "posted" },
    ];
    expect(() =>
      assertCanCreateInvoice("open", soLines, existing, [{ sales_order_item_id: pipe, quantity: 3 }]),
    ).toThrow(/exceeds remaining 2/);
  });

  it("rejects invoicing an already fully invoiced sales order", () => {
    const full: InvoiceQtyConsumption[] = [
      { sales_order_item_id: pipe, quantity: 10, invoice_status: "posted" },
      { sales_order_item_id: wire, quantity: 5, invoice_status: "draft" },
    ];
    expect(soFullyInvoiced(soLines, full)).toBe(true);
    expect(() =>
      assertCanCreateInvoice("open", soLines, full, [{ sales_order_item_id: pipe, quantity: 1 }]),
    ).toThrow(/already fully invoiced/);
  });

  it("rejects invoicing a sales order that is not open", () => {
    expect(() =>
      assertCanCreateInvoice("draft", soLines, [], [{ sales_order_item_id: pipe, quantity: 1 }]),
    ).toThrow(/must be open/);
    expect(() =>
      assertCanCreateInvoice("closed", soLines, [], [{ sales_order_item_id: pipe, quantity: 1 }]),
    ).toThrow(/must be open/);
  });
});
