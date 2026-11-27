import type { InventoryStockRow } from "@/types/database";

function roundQty(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type CompanyStockRow = {
  item_id: string;
  item_name: string;
  brand: string | null;
  model: string | null;
  barcode: string | null;
  item_status: InventoryStockRow["item_status"];
  on_hand: number;
  incoming: number;
  reserved: number;
  unallocated: number;
  available: number;
  quarantine: number;
};

export type WarehouseOnHand = {
  warehouse_id: string;
  warehouse_name: string;
  item_id: string;
  on_hand: number;
  reserved: number;
  available: number;
};

export function companyStockFromWarehouseRows(rows: InventoryStockRow[]): CompanyStockRow[] {
  const byItem = new Map<string, CompanyStockRow>();
  for (const row of rows) {
    const existing = byItem.get(row.item_id);
    if (!existing) {
      byItem.set(row.item_id, {
        item_id: row.item_id,
        item_name: row.item_name,
        brand: row.brand,
        model: row.model,
        barcode: row.barcode,
        item_status: row.item_status,
        on_hand: Number(row.on_hand),
        incoming: 0,
        reserved: Number(row.reserved),
        unallocated: 0,
        available: 0,
        quarantine: 0,
      });
    } else {
      existing.on_hand = roundQty(existing.on_hand + Number(row.on_hand));
      existing.reserved = roundQty(existing.reserved + Number(row.reserved));
    }
  }
  for (const row of byItem.values()) {
    row.available = roundQty(row.on_hand - row.reserved);
    row.unallocated = 0;
  }
  return [...byItem.values()];
}

export function incomingOutstanding(input: {
  shipped: number;
  receivedPhysical: number;
  settledShort: number;
  openBol: boolean;
}) {
  if (!input.openBol) return 0;
  return roundQty(Math.max(input.shipped - input.receivedPhysical - input.settledShort, 0));
}

export const LEGACY_WAREHOUSE_NAME = "Main";

export function isLegacyWarehouse(name: string) {
  return name.trim().toLowerCase() === LEGACY_WAREHOUSE_NAME.toLowerCase();
}

export function warehouseAvailable(onHand: number, allocated: number) {
  return roundQty(onHand - allocated);
}

export function commitmentSplit(committed: number, allocated: number) {
  const committedQty = roundQty(committed);
  const allocatedQty = roundQty(Math.max(0, Math.min(allocated, Math.max(committedQty, 0))));
  return {
    committed: committedQty,
    allocated: allocatedQty,
    unallocated: roundQty(Math.max(committedQty - allocatedQty, 0)),
  };
}
