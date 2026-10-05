import { Card, PageHeader } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { PurchasingListFilters } from "@/components/purchasing-list-filters";
import { parsePurchasingFilters } from "@/lib/purchasing/filters";
import { listBillsOfLading } from "@/lib/purchasing/queries";
import { formatDate } from "@/lib/utils";

export default async function BillsOfLadingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parsePurchasingFilters(await searchParams);
  const rows = await listBillsOfLading(filters.q, filters.from, filters.to);
  const filtered = Boolean(filters.q || filters.from || filters.to);

  return (
    <>
      <PageHeader
        title="Bills of lading"
        description="A bill of lading records what the supplier shipped. Posting updates the purchase order shipped quantity and does not change stock."
      />
      <Card>
        <PurchasingListFilters action="/bills-of-lading" q={filters.q} from={filters.from} to={filters.to} placeholder="BOL, PO, or supplier" />
        <DataTable headers={["BOL number", "PO number", "Supplier", "Shipment date", "Expected arrival", "Status"]}>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-eq-mist/60">
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/bills-of-lading/${row.id}`}>{row.bol_number}</a>
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/purchase-orders/${row.purchase_order_id}`}>{row.po_number}</a>
              </td>
              <td className="px-4 py-3">{row.supplier_name}</td>
              <td className="px-4 py-3">{formatDate(row.shipment_date)}</td>
              <td className="px-4 py-3">{formatDate(row.expected_arrival_date)}</td>
              <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </DataTable>
        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching bills of lading" : "No bills of lading"}
            description="Create a bill of lading from an approved purchase order."
          />
        ) : null}
      </Card>
    </>
  );
}
