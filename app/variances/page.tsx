import { Card, PageHeader } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { listVariances } from "@/lib/purchasing/queries";
import { formatQty } from "@/lib/utils";

export default async function VariancesPage() {
  const rows = await listVariances();

  return (
    <>
      <PageHeader
        title="Variances"
        description="Short, damaged, and excess quantities against a bill of lading line. An open shortage stays incoming. Accepted or resolved shortages are settled and do not create stock. Damaged units stay in quarantine until accepted or resolved."
      />
      <Card>
        <DataTable headers={["Bill of lading", "Receiving report", "Item", "Type", "Qty", "Shipped", "Received", "Good", "Damaged", "Status"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/bills-of-lading/${row.bill_of_lading_id}`}>{row.bol_number}</a>
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/receiving-reports/${row.receiving_report_id}`}>{row.rr_number}</a>
              </td>
              <td className="px-4 py-3">{row.item_name}</td>
              <td className="px-4 py-3 uppercase">{row.discrepancy_type}</td>
              <td className="px-4 py-3">{formatQty(row.quantity)}</td>
              <td className="px-4 py-3">{formatQty(row.shipped_qty)}</td>
              <td className="px-4 py-3">{formatQty(row.actual_received_qty)}</td>
              <td className="px-4 py-3">{formatQty(row.good_qty)}</td>
              <td className="px-4 py-3">{formatQty(row.damaged_qty)}</td>
              <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </DataTable>
        {rows.length === 0 ? (
          <EmptyState title="No variances" description="Posted receiving differences appear here. A partial receipt without Record shortage is unfinished delivery, not a confirmed shortage." />
        ) : null}
      </Card>
    </>
  );
}
