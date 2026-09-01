import { Card, PageHeader, PrimaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { MasterListFilters } from "@/components/master-list-filters";
import { listItems } from "@/lib/data/queries";
import { hasActiveFilters, parseMasterListFilters } from "@/lib/master-data/filters";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseMasterListFilters(await searchParams);
  const items = await listItems(filters);
  const filtered = hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        title="Items"
        description="Catalog items. Serial and barcode can be adjusted on the sales order line."
        actions={
          <Can permission="items.write">
            <PrimaryLink href="/items/new">New item</PrimaryLink>
          </Can>
        }
      />
      <Card>
        <MasterListFilters action="/items" q={filters.q} status={filters.status} />
        <DataTable headers={["Name", "Brand", "Model", "Barcode", "Status"]}>
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-eq-mist/60">
              <td className="px-4 py-3">
                <a className="text-eq-navy underline" href={`/items/${item.id}`}>
                  {item.name}
                </a>
              </td>
              <td className="px-4 py-3">{item.brand ?? "—"}</td>
              <td className="px-4 py-3">{item.model ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs">{item.barcode ?? "—"}</td>
              <td className="px-4 py-3">
                <StatusBadge status={item.status} />
              </td>
            </tr>
          ))}
        </DataTable>
        {items.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching items" : "No items yet"}
            description={
              filtered ? "Try a different search or status filter." : "Add catalog items before creating sales order lines."
            }
            action={
              filtered ? undefined : (
                <Can permission="items.write">
                  <PrimaryLink href="/items/new">New item</PrimaryLink>
                </Can>
              )
            }
          />
        ) : null}
      </Card>
    </>
  );
}
