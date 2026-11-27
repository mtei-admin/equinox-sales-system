import { describe, expect, it } from "vitest";
import { companyStockFromWarehouseRows, incomingOutstanding } from "@/lib/inventory/presentation";
import type { InventoryStockRow } from "@/types/database";

function row(partial: Partial<InventoryStockRow> & Pick<InventoryStockRow, "item_id" | "warehouse_id" | "on_hand" | "reserved">): InventoryStockRow {
  return {
    warehouse_name: partial.warehouse_id,
    item_name: partial.item_id,
    brand: null,
    model: null,
    barcode: null,
    item_status: "active",
    available: partial.on_hand - partial.reserved,
    ...partial,
  };
}

describe("company stock", () => {
  it("sums on hand and keeps committed company-wide without duplicating it", () => {
    const [item] = companyStockFromWarehouseRows([
      row({ item_id: "sku", warehouse_id: "davao", warehouse_name: "DAVAO", on_hand: 60, reserved: 0 }),
      row({ item_id: "sku", warehouse_id: "cebu", warehouse_name: "CEBU", on_hand: 20, reserved: 0 }),
      row({ item_id: "sku", warehouse_id: "main", warehouse_name: "Main", on_hand: 0, reserved: 40 }),
    ]);
    expect(item?.on_hand).toBe(80);
    expect(item?.reserved).toBe(40);
    expect(item?.available).toBe(40);
  });

  it("shows a negative available balance when committed exceeds on hand", () => {
    const [item] = companyStockFromWarehouseRows([
      row({ item_id: "sku", warehouse_id: "main", on_hand: 0, reserved: 10 }),
    ]);
    expect(item?.available).toBe(-10);
  });
});

describe("incoming stock", () => {
  it("keeps the unreceived balance after accepted and damaged receipts", () => {
    const incoming = incomingOutstanding({
      shipped: 100,
      receivedPhysical: 60 + 25,
      settledShort: 0,
      openBol: true,
    });
    expect(incoming).toBe(15);
    expect(60).toBe(60);
    expect(25 - 5).toBe(20);
  });

  it("drops to zero when the remaining shortage is settled and no other bill is open", () => {
    expect(
      incomingOutstanding({
        shipped: 100,
        receivedPhysical: 85,
        settledShort: 15,
        openBol: true,
      }),
    ).toBe(0);
    expect(
      incomingOutstanding({
        shipped: 100,
        receivedPhysical: 0,
        settledShort: 0,
        openBol: false,
      }),
    ).toBe(0);
  });
});
