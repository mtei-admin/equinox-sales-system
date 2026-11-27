import { Card, PageHeader, PrimaryLink, SecondaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { listCompanyStock, listWarehouseOnHand, listWarehouses } from "@/lib/data/queries";
import { listRecentReceiptMovements } from "@/lib/purchasing/queries";
import { isLegacyWarehouse } from "@/lib/inventory/presentation";
import { formatDateTime, formatQty } from "@/lib/utils";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function InventoryStockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selected = firstParam(params.warehouse) || "all";
  const [company, warehouses, onHand, receipts] = await Promise.all([
    listCompanyStock(),
    listWarehouses(),
    listWarehouseOnHand(),
    listRecentReceiptMovements(),
  ]);
  const warehouse = warehouses.find((row) => row.id === selected) ?? null;
  const showCompany = !warehouse;

  return (
    <>
      <PageHeader
        title="Stock on hand"
        description="On hand is the movement ledger. Commited at a warehouse is the ATW/DR quantity allocated there and not yet issued. Available = on hand − commited. Incoming stays company-wide."
        actions={
          <>
            <SecondaryLink href="/inventory/print">Print</SecondaryLink>
            <Can permission="inventory.write">
              <SecondaryLink href="/inventory/reconciliation">Reconcile</SecondaryLink>
              <PrimaryLink href="/inventory/adjustments/new">New adjustment</PrimaryLink>
            </Can>
          </>
        }
      />
      <Card className="mb-4">
        <form method="get" className="flex flex-wrap items-end gap-3 px-4 py-3">
          <label className="min-w-[16rem]">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">Warehouse</span>
            <select className="w-full rounded-md border border-eq-line bg-white px-3 py-2 text-sm" name="warehouse" defaultValue={warehouse?.id ?? "all"}>
              <option value="all">All warehouses</option>
              {warehouses.map((row) => (
                <option key={row.id} value={row.id}>
                  {isLegacyWarehouse(row.name) ? `${row.name} (legacy, unmapped)` : row.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-md bg-eq-navy px-4 py-2 text-sm font-medium text-white">
            Apply
          </button>
        </form>
      </Card>
      <Card className="mb-4 p-4">
        <h2 className="text-sm font-semibold text-eq-ink">All warehouses</h2>
        <p className="mt-1 text-xs text-eq-slate">
          Commited includes allocated and unallocated sales-order quantity exactly once. Incoming is company-wide.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-5">
          <div>
            <dt className="text-xs uppercase text-eq-slate">On hand</dt>
            <dd className="mt-1 text-sm">{formatQty(company.reduce((sum, row) => sum + row.on_hand, 0))}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-eq-slate">Incoming</dt>
            <dd className="mt-1 text-sm">{formatQty(company.reduce((sum, row) => sum + row.incoming, 0))}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-eq-slate">Commited</dt>
            <dd className="mt-1 text-sm">{formatQty(company.reduce((sum, row) => sum + row.reserved, 0))}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-eq-slate">Unallocated</dt>
            <dd className="mt-1 text-sm">{formatQty(company.reduce((sum, row) => sum + row.unallocated, 0))}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-eq-slate">Available</dt>
            <dd className="mt-1 text-sm">{formatQty(company.reduce((sum, row) => sum + row.available, 0))}</dd>
          </div>
        </dl>
      </Card>
      <Card>
        <DataTable
          headers={
            showCompany
              ? ["Item", "On hand", "Incoming", "Commited", "Unallocated", "Available", "Quarantine", "Status"]
              : ["Item", "On hand", "Commited", "Available", "Status"]
          }
        >
          {company.map((row) => {
            const warehouseRow = onHand.find((entry) => entry.item_id === row.item_id && entry.warehouse_id === warehouse?.id);
            return (
              <tr key={row.item_id} className="hover:bg-eq-mist/60">
                <td className="px-4 py-3">
                  <a className="text-eq-navy underline" href={`/items/${row.item_id}`}>
                    {row.item_name}
                  </a>
                  <p className="text-xs text-eq-slate">{[row.brand, row.model, row.barcode].filter(Boolean).join(" · ") || "—"}</p>
                </td>
                <td className="px-4 py-3">{formatQty(showCompany ? row.on_hand : warehouseRow?.on_hand ?? 0)}</td>
                {showCompany ? (
                  <>
                    <td className="px-4 py-3">{formatQty(row.incoming)}</td>
                    <td className="px-4 py-3">{formatQty(row.reserved)}</td>
                    <td className="px-4 py-3">{formatQty(row.unallocated)}</td>
                    <td className="px-4 py-3 font-medium">{formatQty(row.available)}</td>
                    <td className="px-4 py-3">{formatQty(row.quarantine)}</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">{formatQty(warehouseRow?.reserved ?? 0)}</td>
                    <td className="px-4 py-3 font-medium">{formatQty(warehouseRow?.available ?? 0)}</td>
                  </>
                )}
                <td className="px-4 py-3">
                  <StatusBadge status={row.item_status} />
                </td>
              </tr>
            );
          })}
        </DataTable>
        {company.length === 0 ? (
          <EmptyState title="No items" description="Add catalog items, then post an inventory adjustment to record opening stock." />
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
