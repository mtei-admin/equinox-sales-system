import { InventorySummaryPrintView } from "@/components/print/inventory-summary";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { listCompanyStock } from "@/lib/data/queries";
import { inventorySummaryPrint } from "@/lib/print/inventory-summary";
import { todayIsoDate } from "@/lib/utils";

export default async function InventorySummaryPrintPage() {
  const company = await listCompanyStock();
  const rows = company.map((row) => ({
    warehouse_id: "all",
    warehouse_name: "All warehouses",
    item_id: row.item_id,
    item_name: row.item_name,
    brand: row.brand,
    model: row.model,
    barcode: row.barcode,
    item_status: row.item_status,
    on_hand: row.on_hand,
    reserved: row.reserved,
    available: row.available,
  }));

  return (
    <div className="print-page">
      <PrintToolbar backHref="/inventory" />
      <InventorySummaryPrintView summary={inventorySummaryPrint(rows, todayIsoDate())} />
    </div>
  );
}
