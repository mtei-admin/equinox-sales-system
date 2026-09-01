import { Card, PageHeader, PrimaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { MasterListFilters } from "@/components/master-list-filters";
import { listCustomers } from "@/lib/data/queries";
import { hasActiveFilters, parseMasterListFilters } from "@/lib/master-data/filters";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseMasterListFilters(await searchParams);
  const customers = await listCustomers(filters);
  const filtered = hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Billing address and TIN are snapshotted onto sales orders. Inactive customers remain in history."
        actions={
          <Can permission="customers.write">
            <PrimaryLink href="/customers/new">New customer</PrimaryLink>
          </Can>
        }
      />
      <Card>
        <MasterListFilters action="/customers" q={filters.q} status={filters.status} />
        <DataTable headers={["Name", "Contact", "TIN", "Status"]}>
          {customers.map((customer) => (
            <tr key={customer.id} className="hover:bg-eq-mist/60">
              <td className="px-4 py-3">
                <a className="text-eq-navy underline" href={`/customers/${customer.id}`}>
                  {customer.name}
                </a>
              </td>
              <td className="px-4 py-3 text-eq-slate">{customer.contact_person ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs">{customer.tin_number ?? "—"}</td>
              <td className="px-4 py-3">
                <StatusBadge status={customer.status} />
              </td>
            </tr>
          ))}
        </DataTable>
        {customers.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching customers" : "No customers yet"}
            description={
              filtered
                ? "Try a different search or status filter."
                : "Create a customer before raising a sales order."
            }
            action={
              filtered ? undefined : (
                <Can permission="customers.write">
                  <PrimaryLink href="/customers/new">New customer</PrimaryLink>
                </Can>
              )
            }
          />
        ) : null}
      </Card>
    </>
  );
}
