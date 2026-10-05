import { formatDate, formatQty } from "@/lib/utils";
import type { InventoryStockRow } from "@/types/database";

export type InventorySummaryLine = {
  id: string;
  title: string;
  detail: string;
  onHand: string;
  reserved: string;
  available: string;
  status: string;
};

export type InventorySummaryPrint = {
  title: string;
  asOf: string;
  warehouseName: string;
  note: string;
  lines: InventorySummaryLine[];
  totals: { onHand: string; reserved: string; available: string };
};

function roundQty(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function warehouseName(rows: InventoryStockRow[]) {
  const names = [...new Set(rows.map((row) => row.warehouse_name.trim()).filter(Boolean))];
  if (names.length === 0) return "—";
  return names.join(", ");
}

function lineDetail(row: InventoryStockRow) {
  return [row.brand, row.model, row.barcode].filter((part) => part?.trim()).join(" · ");
}

export function inventorySummaryPrint(rows: InventoryStockRow[], asOf: string): InventorySummaryPrint {
  const onHand = roundQty(rows.reduce((sum, row) => sum + row.on_hand, 0));
  const reserved = roundQty(rows.reduce((sum, row) => sum + row.reserved, 0));
  const available = roundQty(rows.reduce((sum, row) => sum + row.available, 0));

  return {
    title: "Inventory Summary",
    asOf: formatDate(asOf),
    warehouseName: warehouseName(rows),
    note: "On-hand is the movement ledger. Commited is open or closed sales-order quantity not yet issued. Available = on-hand − commited.",
    lines: rows.map((row) => ({
      id: row.item_id,
      title: row.item_name,
      detail: lineDetail(row),
      onHand: formatQty(row.on_hand),
      reserved: formatQty(row.reserved),
      available: formatQty(row.available),
      status: row.item_status,
    })),
    totals: {
      onHand: formatQty(onHand),
      reserved: formatQty(reserved),
      available: formatQty(available),
    },
  };
}
