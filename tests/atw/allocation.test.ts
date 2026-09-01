import { describe, expect, it } from "vitest";
import {
  assertCanCreateAtw,
  eligibleInvoiceLinesForAtw,
  invoiceFullyAllocated,
  invoiceHeaderRemaining,
  invoiceItemRemainingQty,
  type AtwQtyConsumption,
} from "@/lib/atw/allocation";

const pipe = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const wire = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const invoiceLines = [
  { id: pipe, quantity: 10 },
  { id: wire, quantity: 5 },
];

describe("ATW/DR from invoice", () => {
  it("copies only invoice lines that still have remaining quantity", () => {
    const existing: AtwQtyConsumption[] = [{ invoice_item_id: pipe, quantity: 10, atw_status: "released" }];
    expect(eligibleInvoiceLinesForAtw(invoiceLines, existing)).toEqual([
      { invoice_item_id: wire, invoiced: 5, allocated: 0, remaining: 5 },
    ]);
  });

  it("full ATW consumes all remaining on the selected lines", () => {
    expect(() =>
      assertCanCreateAtw("posted", invoiceLines, [], [
        { invoice_item_id: pipe, quantity: 10 },
        { invoice_item_id: wire, quantity: 5 },
      ]),
    ).not.toThrow();
    const after: AtwQtyConsumption[] = [
      { invoice_item_id: pipe, quantity: 10, atw_status: "draft" },
      { invoice_item_id: wire, quantity: 5, atw_status: "draft" },
    ];
    expect(invoiceHeaderRemaining(invoiceLines, after)).toBe(0);
    expect(invoiceFullyAllocated(invoiceLines, after)).toBe(true);
  });

  it("partial ATW leaves remaining for later documents", () => {
    expect(() =>
      assertCanCreateAtw("posted", invoiceLines, [], [{ invoice_item_id: pipe, quantity: 4 }]),
    ).not.toThrow();
    const after: AtwQtyConsumption[] = [{ invoice_item_id: pipe, quantity: 4, atw_status: "released" }];
    expect(invoiceItemRemainingQty(10, pipe, after)).toBe(6);
    expect(invoiceItemRemainingQty(5, wire, after)).toBe(5);
    expect(invoiceFullyAllocated(invoiceLines, after)).toBe(false);
  });

  it("allows multiple ATW/DR documents against one invoice until remaining is 0", () => {
    const first: AtwQtyConsumption[] = [{ invoice_item_id: pipe, quantity: 6, atw_status: "released" }];
    expect(() =>
      assertCanCreateAtw("posted", invoiceLines, first, [{ invoice_item_id: pipe, quantity: 4 }]),
    ).not.toThrow();
    const both: AtwQtyConsumption[] = [
      ...first,
      { invoice_item_id: pipe, quantity: 4, atw_status: "draft" },
    ];
    expect(invoiceItemRemainingQty(10, pipe, both)).toBe(0);
    expect(() =>
      assertCanCreateAtw("posted", invoiceLines, both, [{ invoice_item_id: wire, quantity: 5 }]),
    ).not.toThrow();
  });

  it("rejects over-allocation above remaining invoice quantity", () => {
    const existing: AtwQtyConsumption[] = [{ invoice_item_id: pipe, quantity: 8, atw_status: "released" }];
    expect(() =>
      assertCanCreateAtw("posted", invoiceLines, existing, [{ invoice_item_id: pipe, quantity: 3 }]),
    ).toThrow(/exceeds remaining 2/);
  });

  it("rejects ATW/DR on an already fully allocated invoice", () => {
    const full: AtwQtyConsumption[] = [
      { invoice_item_id: pipe, quantity: 10, atw_status: "released" },
      { invoice_item_id: wire, quantity: 5, atw_status: "draft" },
    ];
    expect(invoiceFullyAllocated(invoiceLines, full)).toBe(true);
    expect(() =>
      assertCanCreateAtw("posted", invoiceLines, full, [{ invoice_item_id: pipe, quantity: 1 }]),
    ).toThrow(/already fully allocated/);
  });

  it("returns remaining when an ATW/DR is cancelled", () => {
    const posted: AtwQtyConsumption[] = [{ invoice_item_id: pipe, quantity: 10, atw_status: "released" }];
    expect(invoiceItemRemainingQty(10, pipe, posted)).toBe(0);
    const cancelled = posted.map((row) => ({ ...row, atw_status: "cancelled" as const }));
    expect(invoiceItemRemainingQty(10, pipe, cancelled)).toBe(10);
  });

  it("rejects ATW/DR unless the invoice is posted", () => {
    expect(() =>
      assertCanCreateAtw("draft", invoiceLines, [], [{ invoice_item_id: pipe, quantity: 1 }]),
    ).toThrow(/posted invoice/);
    expect(() =>
      assertCanCreateAtw("cancelled", invoiceLines, [], [{ invoice_item_id: pipe, quantity: 1 }]),
    ).toThrow(/posted invoice/);
  });
});
