import { Card, PageHeader, PrimaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { MasterListFilters } from "@/components/master-list-filters";
import { listSuppliers } from "@/lib/purchasing/queries";
import { hasActiveFilters, parseMasterListFilters } from "@/lib/master-data/filters";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseMasterListFilters(await searchParams);
  const rows = await listSuppliers(filters.q, filters.status);
  const filtered = hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Supplier master. Inactive suppliers stay on file when they already have purchase orders."
        actions={
          <Can permission="suppliers.write">
            <PrimaryLink href="/suppliers/new">New supplier</PrimaryLink>
          </Can>
        }
      />
      <Card>
        <MasterListFilters action="/suppliers" q={filters.q} status={filters.status} />
        <DataTable headers={["Code", "Name", "Contact", "Terms", "Status"]}>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-eq-mist/60">
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/suppliers/${row.id}`}>
                  {row.supplier_code}
                </a>
              </td>
              <td className="px-4 py-3">{row.name}</td>
              <td className="px-4 py-3 text-eq-slate">{row.contact_person ?? "—"}</td>
              <td className="px-4 py-3">{row.payment_terms ?? "—"}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </DataTable>
        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching suppliers" : "No suppliers yet"}
            description={
              filtered ? "Try a different search or status filter." : "Create a supplier before raising a purchase order."
            }
            action={
              filtered ? undefined : (
                <Can permission="suppliers.write">
                  <PrimaryLink href="/suppliers/new">New supplier</PrimaryLink>
                </Can>
              )
            }
          />
        ) : null}
      </Card>
    </>
  );
}
