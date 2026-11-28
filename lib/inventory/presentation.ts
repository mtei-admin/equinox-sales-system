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

/** Warehouse allocation still open after issued withdrawal quantity. Sign: positive allocated. */
export function warehouseAllocatedRemaining(atwQty: number, issuedWsQty: number) {
  return roundQty(Math.max(0, atwQty - issuedWsQty));
}

/**
 * Company commitment still open after issued withdrawal quantity.
 * Create event: open_sales_order. Release event: issue_withdrawal_slip
 * (issued qty is subtracted once from both company committed and warehouse reserved).
 */
export function companyCommittedRemaining(openClosedSoQty: number, issuedWsQty: number) {
  return roundQty(Math.max(0, openClosedSoQty - issuedWsQty));
}

export type BranchCommitmentSnapshot = {
  company: ReturnType<typeof commitmentSplit> & { on_hand: number; available: number; incoming: number };
  branches: Record<string, { on_hand: number; committed: number; available: number }>;
};

/** Build All-warehouses and per-branch stock figures for one item. Incoming stays company-wide. */
export function branchCommitmentSnapshot(input: {
  onHandByWarehouse: Record<string, number>;
  allocatedByWarehouse: Record<string, number>;
  committed: number;
  incoming?: number;
}): BranchCommitmentSnapshot {
  const allocatedTotal = roundQty(
    Object.values(input.allocatedByWarehouse).reduce((sum, qty) => sum + Number(qty), 0),
  );
  const companyOnHand = roundQty(
    Object.values(input.onHandByWarehouse).reduce((sum, qty) => sum + Number(qty), 0),
  );
  const split = commitmentSplit(input.committed, allocatedTotal);
  const branches: BranchCommitmentSnapshot["branches"] = {};
  for (const [name, onHand] of Object.entries(input.onHandByWarehouse)) {
    const committed = roundQty(input.allocatedByWarehouse[name] ?? 0);
    branches[name] = {
      on_hand: roundQty(onHand),
      committed,
      available: warehouseAvailable(onHand, committed),
    };
  }
  return {
    company: {
      ...split,
      on_hand: companyOnHand,
      available: roundQty(companyOnHand - split.committed),
      incoming: roundQty(input.incoming ?? 0),
    },
    branches,
  };
}
