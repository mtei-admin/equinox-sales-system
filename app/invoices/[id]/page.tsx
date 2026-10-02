import { notFound } from "next/navigation";
import { Card, PageHeader, PrimaryLink, SecondaryLink } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { AuditFields } from "@/components/audit-fields";
import { Can } from "@/components/can";
import { CancelInvoiceButton, PostInvoiceButton } from "@/components/forms/invoice-status-actions";
import { getInvoice } from "@/lib/data/queries";
import { formatDate, formatMoney, formatQty } from "@/lib/utils";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const canPost = invoice.status === "draft";
  const canCancel = invoice.status !== "cancelled";
  const canCreateAtw = invoice.status === "posted" && invoice.remaining_qty > 0;

  return (
    <>
      <PageHeader
        title={invoice.invoice_number}
        description={invoice.customer_name}
        actions={
          <>
            {canPost ? (
              <Can permission="invoices.write">
                <PostInvoiceButton id={invoice.id} />
              </Can>
            ) : null}
            {canCreateAtw ? (
              <Can permission="atw-dr.write">
                <PrimaryLink href={`/atw-dr/new?invoice_id=${invoice.id}`}>Create ATW/DR</PrimaryLink>
              </Can>
            ) : null}
            {canCancel ? (
              <Can permission="invoices.write">
                <CancelInvoiceButton id={invoice.id} />
              </Can>
            ) : null}
            <SecondaryLink href={`/invoices/${invoice.id}/print`}>Print</SecondaryLink>
            <SecondaryLink href="/invoices">Back</SecondaryLink>
          </>
        }
      />
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-eq-slate">
          <StatusBadge status={invoice.status} />
          <span>{formatDate(invoice.order_date)}</span>
          <span>Qty {formatQty(invoice.total_quantity)}</span>
          <span>Grand total {formatMoney(invoice.grand_total)}</span>
          <span>Remaining {formatQty(invoice.remaining_qty)}</span>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Sales order</dt>
            <dd className="mt-1 text-sm">
              <a className="text-eq-navy underline" href={`/sales-orders/${invoice.sales_order_id}`}>
                {invoice.so_number || "Sales order"}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Customer</dt>
            <dd className="mt-1 text-sm">{invoice.customer_name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Delivery address</dt>
            <dd className="mt-1 text-sm">{invoice.delivery_address ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Sales employee</dt>
            <dd className="mt-1 text-sm">{invoice.sales_employee_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Term</dt>
            <dd className="mt-1 text-sm">{invoice.term ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Reference</dt>
            <dd className="mt-1 text-sm">{invoice.reference_no ?? "—"}</dd>
          </div>
        </dl>
        {invoice.remarks ? <p className="mt-4 text-sm text-eq-slate">{invoice.remarks}</p> : null}

        <h2 className="mt-6 text-sm font-semibold text-eq-ink">Lines and ATW/DR allocation</h2>
        <p className="mt-1 text-xs text-eq-slate">
          Remaining = invoiced − allocated to ATW/DR (draft and released). Cancelled ATW/DR documents do not consume quantity.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-eq-slate">
              <tr>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Invoiced</th>
                <th className="py-2 pr-3">Allocated</th>
                <th className="py-2 pr-3">Remaining</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2 pr-3">Tax</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.invoice_items.map((line) => (
                <tr key={line.id} className="border-t border-eq-line">
                  <td className="py-2 pr-3">
                    <p>{line.description ?? line.model ?? "Item"}</p>
                    <p className="text-xs text-eq-slate">{[line.model, line.barcode].filter(Boolean).join(" · ") || line.uom}</p>
                  </td>
                  <td className="py-2 pr-3">
                    {formatQty(line.quantity)} {line.uom}
                  </td>
                  <td className="py-2 pr-3">{formatQty(line.atw_qty)}</td>
                  <td className="py-2 pr-3">{formatQty(line.remaining_qty)}</td>
                  <td className="py-2 pr-3">{formatMoney(line.unit_price)}</td>
                  <td className="py-2 pr-3">{formatMoney(line.tax_amount)}</td>
                  <td className="py-2">{formatMoney(line.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AuditFields
          createdAt={invoice.created_at}
          createdByName={invoice.created_by_name}
          updatedAt={invoice.updated_at}
          updatedByName={invoice.updated_by_name}
          cancelledAt={invoice.cancelled_at}
          cancelledByName={invoice.cancelled_by_name}
          cancellationReason={invoice.cancellation_reason}
        />
      </Card>
    </>
  );
}
