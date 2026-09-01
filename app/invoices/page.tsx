import { Card, PageHeader, PrimaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { InvoiceListFilters } from "@/components/invoice-list-filters";
import { listInvoices } from "@/lib/data/queries";
import { hasInvoiceFilters, parseInvoiceListFilters } from "@/lib/invoices/filters";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseInvoiceListFilters(await searchParams);
  const invoices = await listInvoices(filters);
  const filtered = hasInvoiceFilters(filters);

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Created from an open sales order. Invoice number is typed from the pre-printed book. Quantity cannot exceed remaining SO qty."
        actions={
          <Can permission="invoices.write">
            <PrimaryLink href="/invoices/new">New invoice</PrimaryLink>
          </Can>
        }
      />
      <Card>
        <InvoiceListFilters q={filters.q} status={filters.status} />
        <DataTable headers={["Number", "Sales order", "Customer", "Date", "Status", "Total"]}>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-eq-mist/60">
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/invoices/${invoice.id}`}>
                  {invoice.invoice_number}
                </a>
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/sales-orders/${invoice.sales_order_id}`}>
                  {invoice.so_number || "SO"}
                </a>
              </td>
              <td className="px-4 py-3">{invoice.customer_name}</td>
              <td className="px-4 py-3">{formatDate(invoice.order_date)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={invoice.status} />
              </td>
              <td className="px-4 py-3">{formatMoney(invoice.grand_total)}</td>
            </tr>
          ))}
        </DataTable>
        {invoices.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching invoices" : "No invoices"}
            description={
              filtered
                ? "Try a different search or status filter."
                : "Create from an open sales order. Remaining quantity is enforced in Postgres."
            }
            action={
              filtered ? undefined : (
                <Can permission="invoices.write">
                  <PrimaryLink href="/invoices/new">New invoice</PrimaryLink>
                </Can>
              )
            }
          />
        ) : null}
      </Card>
    </>
  );
}
