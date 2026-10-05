import { Card, PageHeader } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { PurchasingListFilters } from "@/components/purchasing-list-filters";
import { parsePurchasingFilters } from "@/lib/purchasing/filters";
import { listReceivingReports } from "@/lib/purchasing/queries";
import { formatDate } from "@/lib/utils";

export default async function ReceivingReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parsePurchasingFilters(await searchParams);
  const rows = await listReceivingReports(filters.q, filters.from, filters.to);
  const filtered = Boolean(filters.q || filters.from || filters.to);

  return (
    <>
      <PageHeader
        title="Receiving reports"
        description="Posting a receiving report adds good quantity to stock on hand. Draft reports do not move inventory."
      />
      <Card>
        <PurchasingListFilters action="/receiving-reports" q={filters.q} from={filters.from} to={filters.to} placeholder="RR, BOL, PO, or supplier" />
        <DataTable headers={["RR number", "BOL number", "PO number", "Supplier", "Receiving date", "Status"]}>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-eq-mist/60">
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/receiving-reports/${row.id}`}>{row.rr_number}</a>
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/bills-of-lading/${row.bill_of_lading_id}`}>{row.bol_number}</a>
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/purchase-orders/${row.purchase_order_id}`}>{row.po_number}</a>
              </td>
              <td className="px-4 py-3">{row.supplier_name}</td>
              <td className="px-4 py-3">{formatDate(row.receiving_date)}</td>
              <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </DataTable>
        {rows.length === 0 ? (
          <EmptyState title={filtered ? "No matching receiving reports" : "No receiving reports"} description="Create a receiving report from a posted bill of lading." />
        ) : null}
      </Card>
    </>
  );
}
