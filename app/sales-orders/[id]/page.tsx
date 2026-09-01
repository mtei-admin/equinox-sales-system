import { notFound } from "next/navigation";
import { Card, PageHeader, PrimaryLink, SecondaryLink } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { AuditFields } from "@/components/audit-fields";
import { Can } from "@/components/can";
import { CancelSalesOrderButton, OpenSalesOrderButton } from "@/components/forms/sales-order-status-actions";
import { getSalesOrder } from "@/lib/data/queries";
import { formatDate, formatMoney, formatQty } from "@/lib/utils";

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getSalesOrder(id);
  if (!order) notFound();
  const lines = order.sales_order_items;
  const canEdit = order.status === "draft";
  const canOpen = order.status === "draft";
  const canCancel = order.status !== "cancelled";

  return (
    <>
      <PageHeader
        title={order.so_number}
        description={order.customer_name}
        actions={
          <>
            {canEdit ? (
              <Can permission="sales-orders.write">
                <PrimaryLink href={`/sales-orders/${order.id}/edit`}>Edit</PrimaryLink>
              </Can>
            ) : null}
            {canOpen ? (
              <Can permission="sales-orders.write">
                <OpenSalesOrderButton id={order.id} />
              </Can>
            ) : null}
            {order.status === "open" && order.remaining_qty > 0 ? (
              <Can permission="invoices.write">
                <PrimaryLink href={`/invoices/new?sales_order_id=${order.id}`}>Create invoice</PrimaryLink>
              </Can>
            ) : null}
            {canCancel ? (
              <Can permission="sales-orders.write">
                <CancelSalesOrderButton id={order.id} />
              </Can>
            ) : null}
            <SecondaryLink href="/sales-orders">Back</SecondaryLink>
          </>
        }
      />
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-eq-slate">
          <StatusBadge status={order.status} />
          <span>{formatDate(order.order_date)}</span>
          <span>Total qty {formatQty(order.total_quantity)}</span>
          <span>Grand total {formatMoney(order.grand_total)}</span>
          <span>Remaining {formatQty(order.remaining_qty)}</span>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Customer</dt>
            <dd className="mt-1 text-sm">{order.customer_name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Delivery address</dt>
            <dd className="mt-1 text-sm">{order.delivery_address ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Sales employee</dt>
            <dd className="mt-1 text-sm">{order.sales_employee_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Term</dt>
            <dd className="mt-1 text-sm">{order.term ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Order type</dt>
            <dd className="mt-1 text-sm">{order.order_type ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Reference</dt>
            <dd className="mt-1 text-sm">{order.reference_no ?? "—"}</dd>
          </div>
        </dl>
        {order.remarks ? <p className="mt-4 text-sm text-eq-slate">{order.remarks}</p> : null}

        <h2 className="mt-6 text-sm font-semibold text-eq-ink">Lines and invoice allocation</h2>
        <p className="mt-1 text-xs text-eq-slate">Remaining = ordered − invoiced (draft and posted invoices). Cancelled invoices do not consume quantity.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-eq-slate">
              <tr>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Ordered</th>
                <th className="py-2 pr-3">Invoiced</th>
                <th className="py-2 pr-3">Remaining</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t border-eq-line">
                  <td className="py-2 pr-3">
                    <p>{line.description ?? line.model ?? "Item"}</p>
                    <p className="text-xs text-eq-slate">
                      {[line.model, line.barcode].filter(Boolean).join(" · ") || line.uom}
                    </p>
                  </td>
                  <td className="py-2 pr-3">
                    {formatQty(line.quantity)} {line.uom}
                  </td>
                  <td className="py-2 pr-3">{formatQty(line.invoiced_qty)}</td>
                  <td className="py-2 pr-3">{formatQty(line.remaining_qty)}</td>
                  <td className="py-2 pr-3">{formatMoney(line.unit_price)}</td>
                  <td className="py-2">{formatMoney(line.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AuditFields
          createdAt={order.created_at}
          createdByName={order.created_by_name}
          updatedAt={order.updated_at}
          updatedByName={order.updated_by_name}
          cancelledAt={order.cancelled_at}
          cancelledByName={order.cancelled_by_name}
          cancellationReason={order.cancellation_reason}
        />
      </Card>
    </>
  );
}
