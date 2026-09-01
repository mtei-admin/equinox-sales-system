import { Card, PageHeader, PrimaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { WithdrawalSlipListFilters } from "@/components/withdrawal-slip-list-filters";
import { listWithdrawalSlips } from "@/lib/data/queries";
import { hasWithdrawalSlipFilters, parseWithdrawalSlipListFilters } from "@/lib/withdrawal-slips/filters";
import { formatDate, formatQty } from "@/lib/utils";

export default async function WithdrawalSlipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseWithdrawalSlipListFilters(await searchParams);
  const rows = await listWithdrawalSlips(filters);
  const filtered = hasWithdrawalSlipFilters(filters);

  return (
    <>
      <PageHeader
        title="Withdrawal slips"
        description="Search a released ATW or DR, then create one slip that copies every line. A second active slip is rejected."
        actions={
          <Can permission="withdrawal-slips.write">
            <PrimaryLink href="/withdrawal-slips/new">New withdrawal slip</PrimaryLink>
          </Can>
        }
      />
      <Card>
        <WithdrawalSlipListFilters q={filters.q} status={filters.status} />
        <DataTable headers={["Number", "ATW/DR", "Customer", "Date", "Status", "Qty"]}>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-eq-mist/60">
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/withdrawal-slips/${row.id}`}>
                  {row.ws_number}
                </a>
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/atw-dr/${row.atw_id}`}>
                  {row.atw_number || "ATW/DR"}
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
            title={filtered ? "No matching withdrawal slips" : "No withdrawal slips"}
            description={
              filtered
                ? "Try a different search or status filter."
                : "Warehouse creates a slip from a released ATW/DR. One non-cancelled slip per document."
            }
            action={
              filtered ? undefined : (
                <Can permission="withdrawal-slips.write">
                  <PrimaryLink href="/withdrawal-slips/new">New withdrawal slip</PrimaryLink>
                </Can>
              )
            }
          />
        ) : null}
      </Card>
    </>
  );
}
