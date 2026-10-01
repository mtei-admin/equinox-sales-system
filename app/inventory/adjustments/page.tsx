import { Card, PageHeader, PrimaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { AdjustmentListFilters } from "@/components/adjustment-list-filters";
import { listInventoryAdjustments } from "@/lib/data/queries";
import { hasAdjustmentFilters, parseAdjustmentListFilters } from "@/lib/inventory/filters";
import { formatDate } from "@/lib/utils";

export default async function InventoryAdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseAdjustmentListFilters(await searchParams);
  const rows = await listInventoryAdjustments(filters);
  const filtered = hasAdjustmentFilters(filters);

  return (
    <>
      <PageHeader
        title="Inventory adjustments"
        description="Draft, post, or cancel. Posted adjustments write the movement ledger. This is how opening stock and counts are recorded."
        actions={
          <Can permission="inventory.write">
            <PrimaryLink href="/inventory/adjustments/new">New adjustment</PrimaryLink>
          </Can>
        }
      />
      <Card>
        <AdjustmentListFilters q={filters.q} status={filters.status} />
        <DataTable headers={["Number", "Status", "Reason", "Date"]}>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-eq-mist/60">
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/inventory/adjustments/${row.id}`}>
                  {row.adj_number}
                </a>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3">{row.reason || row.remarks || "—"}</td>
              <td className="px-4 py-3">{formatDate(row.created_at)}</td>
            </tr>
          ))}
        </DataTable>
        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching adjustments" : "No adjustments"}
            description={
              filtered
                ? "Try a different search or status filter."
                : "Create a draft, then post it to change on-hand quantity."
            }
            action={
              filtered ? undefined : (
                <Can permission="inventory.write">
                  <PrimaryLink href="/inventory/adjustments/new">New adjustment</PrimaryLink>
                </Can>
              )
            }
          />
        ) : null}
      </Card>
    </>
  );
}
