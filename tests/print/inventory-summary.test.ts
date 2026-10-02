import { describe, expect, it } from "vitest";
import { inventorySummaryPrint } from "@/lib/print/inventory-summary";
import { formatDate, formatQty } from "@/lib/utils";
import type { InventoryStockRow } from "@/types/database";

function row(partial: Partial<InventoryStockRow> & Pick<InventoryStockRow, "item_id" | "item_name">): InventoryStockRow {
  return {
    warehouse_id: "wh-1",
    warehouse_name: "Main",
    brand: null,
    model: null,
    barcode: null,
    item_status: "active",
    on_hand: 0,
    reserved: 0,
    available: 0,
    ...partial,
  };
}

describe("inventory summary print", () => {
  it("prints current on-hand, reserved, and available for each item", () => {
    const summary = inventorySummaryPrint(
      [
        row({
          item_id: "item-1",
          item_name: "Widget",
          brand: "Acme",
          model: "W-1",
          barcode: "BC-9",
          on_hand: 10,
          reserved: 4,
          available: 6,
        }),
        row({
          item_id: "item-2",
          item_name: "Inactive part",
          item_status: "inactive",
          on_hand: 1,
          reserved: 0,
          available: 1,
        }),
      ],
      "2026-10-02",
    );

    expect(summary.title).toBe("Inventory Summary");
    expect(summary.asOf).toBe(formatDate("2026-10-02"));
    expect(summary.warehouseName).toBe("Main");
    expect(summary.lines[0]).toMatchObject({
      title: "Widget",
      detail: "Acme · W-1 · BC-9",
      onHand: formatQty(10),
      reserved: formatQty(4),
      available: formatQty(6),
      status: "active",
    });
    expect(summary.lines[1]?.status).toBe("inactive");
    expect(summary.totals).toEqual({
      onHand: formatQty(11),
      reserved: formatQty(4),
      available: formatQty(7),
    });
  });

  it("prints an empty summary without inventing a warehouse", () => {
    const summary = inventorySummaryPrint([], "2026-10-02");
    expect(summary.lines).toEqual([]);
    expect(summary.warehouseName).toBe("—");
    expect(summary.totals.onHand).toBe(formatQty(0));
  });
});
