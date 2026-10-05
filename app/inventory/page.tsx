import { Card, PageHeader, PrimaryLink, SecondaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { listInventoryStock } from "@/lib/data/queries";
import { listRecentReceiptMovements } from "@/lib/purchasing/queries";
import { formatDateTime, formatQty } from "@/lib/utils";

export default async function InventoryStockPage() {
  const [rows, receipts] = await Promise.all([listInventoryStock(), listRecentReceiptMovements()]);

  return (
    <>
      <PageHeader
        title="Stock on hand"
        description="On-hand is the movement ledger. Commited is open/closed sales-order quantity not yet issued. Available = on-hand − commited."
        actions={
          <>
            <SecondaryLink href="/inventory/print">Print</SecondaryLink>
            <Can permission="inventory.write">
              <PrimaryLink href="/inventory/adjustments/new">New adjustment</PrimaryLink>
            </Can>
          </>
        }
      />
      <Card>
        <DataTable headers={["Item", "On hand", "Commited", "Available", "Status"]}>
          {rows.map((row) => (
            <tr key={row.item_id} className="hover:bg-eq-mist/60">
              <td className="px-4 py-3">
                <a className="text-eq-navy underline" href={`/items/${row.item_id}`}>
                  {row.item_name}
                </a>
                <p className="text-xs text-eq-slate">{[row.brand, row.model, row.barcode].filter(Boolean).join(" · ") || "—"}</p>
              </td>
              <td className="px-4 py-3">{formatQty(row.on_hand)}</td>
              <td className="px-4 py-3">{formatQty(row.reserved)}</td>
              <td className="px-4 py-3 font-medium">{formatQty(row.available)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.item_status} />
              </td>
            </tr>
          ))}
        </DataTable>
        {rows.length === 0 ? (
          <EmptyState
            title="No items"
            description="Add catalog items, then post an inventory adjustment to record opening stock."
            action={
              <Can permission="inventory.write">
                <PrimaryLink href="/inventory/adjustments/new">New adjustment</PrimaryLink>
              </Can>
            }
          />
        ) : null}
      </Card>
      {receipts.length > 0 ? (
        <Card className="mt-6">
          <h2 className="border-b border-eq-line px-4 py-3 text-sm font-semibold text-eq-ink">Recent receiving movements</h2>
          <DataTable headers={["When", "Item", "Quantity", "Receiving report"]}>
            {receipts.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">{formatDateTime(row.occurredAt)}</td>
                <td className="px-4 py-3">{row.itemName}</td>
                <td className="px-4 py-3">{row.reversal ? "Reversal " : "Receipt "}{formatQty(row.quantity)}</td>
                <td className="px-4 py-3">
                  <a className="text-eq-navy underline" href={`/receiving-reports/${row.rrId}`}>{row.rrNumber}</a>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      ) : null}
    </>
  );
}
