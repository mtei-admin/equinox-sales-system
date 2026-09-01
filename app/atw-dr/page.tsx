import { Card, PageHeader, PrimaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { AtwListFilters } from "@/components/atw-list-filters";
import { listAtw } from "@/lib/data/queries";
import { hasAtwFilters, parseAtwListFilters } from "@/lib/atw/filters";
import { formatDate, formatQty } from "@/lib/utils";

export default async function AtwPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseAtwListFilters(await searchParams);
  const rows = await listAtw(filters);
  const filtered = hasAtwFilters(filters);

  return (
    <>
      <PageHeader
        title="ATW / DR"
        description="Created from a posted invoice. Document type is ATW or Delivery Receipt. Quantity cannot exceed remaining invoice qty."
        actions={
          <Can permission="atw-dr.write">
            <PrimaryLink href="/atw-dr/new">New ATW/DR</PrimaryLink>
          </Can>
        }
      />
      <Card>
        <AtwListFilters q={filters.q} status={filters.status} documentType={filters.document_type} />
        <DataTable headers={["Number", "Type", "Invoice", "Customer", "Date", "Status", "Qty"]}>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-eq-mist/60">
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/atw-dr/${row.id}`}>
                  {row.atw_number}
                </a>
              </td>
              <td className="px-4 py-3 uppercase">{row.document_type}</td>
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/invoices/${row.invoice_id}`}>
                  {row.invoice_number || "Invoice"}
                </a>
              </td>
              <td className="px-4 py-3">{row.customer_name}</td>
              <td className="px-4 py-3">{formatDate(row.order_date)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3">{formatQty(row.total_quantity)}</td>
            </tr>
          ))}
        </DataTable>
        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching ATW/DR documents" : "No ATW/DR documents"}
            description={
              filtered
                ? "Try a different search, status, or type filter."
                : "Create from a posted invoice. Remaining quantity is enforced in Postgres."
            }
            action={
              filtered ? undefined : (
                <Can permission="atw-dr.write">
                  <PrimaryLink href="/atw-dr/new">New ATW/DR</PrimaryLink>
                </Can>
              )
            }
          />
        ) : null}
      </Card>
    </>
  );
}
