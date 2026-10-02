import { InventorySummaryPrintView } from "@/components/print/inventory-summary";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { listInventoryStock } from "@/lib/data/queries";
import { inventorySummaryPrint } from "@/lib/print/inventory-summary";
import { todayIsoDate } from "@/lib/utils";

export default async function InventorySummaryPrintPage() {
  const rows = await listInventoryStock();

  return (
    <div className="print-page">
      <PrintToolbar backHref="/inventory" />
      <InventorySummaryPrintView summary={inventorySummaryPrint(rows, todayIsoDate())} />
    </div>
  );
}
