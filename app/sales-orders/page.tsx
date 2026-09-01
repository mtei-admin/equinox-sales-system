import { Card, PageHeader, PrimaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { SalesOrderListFilters } from "@/components/sales-order-list-filters";
import { listSalesOrders } from "@/lib/data/queries";
import { hasSalesOrderFilters, parseSalesOrderListFilters } from "@/lib/sales-orders/filters";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseSalesOrderListFilters(await searchParams);
  const orders = await listSalesOrders(filters);
  const filtered = hasSalesOrderFilters(filters);

  return (
    <>
      <PageHeader
        title="Sales orders"
        description="Draft, then open for invoicing. Remaining quantity is SO qty minus non-cancelled invoice qty."
        actions={
          <Can permission="sales-orders.write">
            <PrimaryLink href="/sales-orders/new">New sales order</PrimaryLink>
          </Can>
        }
      />
      <Card>
        <SalesOrderListFilters q={filters.q} status={filters.status} />
        <DataTable headers={["Number", "Customer", "Date", "Status", "Total"]}>
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-eq-mist/60">
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/sales-orders/${order.id}`}>
                  {order.so_number}
                </a>
              </td>
              <td className="px-4 py-3">{order.customer_name}</td>
              <td className="px-4 py-3">{formatDate(order.order_date)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={order.status} />
              </td>
              <td className="px-4 py-3">{formatMoney(order.grand_total)}</td>
            </tr>
          ))}
        </DataTable>
        {orders.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching sales orders" : "No sales orders"}
            description={
              filtered
                ? "Try a different search or status filter."
                : "Create a draft, then open it so invoices can allocate remaining quantity."
            }
            action={
              filtered ? undefined : (
                <Can permission="sales-orders.write">
                  <PrimaryLink href="/sales-orders/new">New sales order</PrimaryLink>
                </Can>
              )
            }
          />
        ) : null}
      </Card>
    </>
  );
}
