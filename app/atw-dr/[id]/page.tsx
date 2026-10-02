import { notFound } from "next/navigation";
import { Card, PageHeader, PrimaryLink, SecondaryLink } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { AuditFields } from "@/components/audit-fields";
import { Can } from "@/components/can";
import { CancelAtwButton, ReleaseAtwButton } from "@/components/forms/atw-status-actions";
import { getAtw } from "@/lib/data/queries";
import { formatDate, formatMoney, formatQty } from "@/lib/utils";

export default async function AtwDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getAtw(id);
  if (!doc) notFound();
  const canRelease = doc.status === "draft";
  const canCancel = doc.status !== "cancelled";
  const typeLabel = doc.document_type === "dr" ? "Delivery Receipt" : "ATW";
  const canCreateSlip = doc.status === "released" && !doc.active_withdrawal_slip_id;

  return (
    <>
      <PageHeader
        title={doc.atw_number}
        description={`${typeLabel} · ${doc.customer_name}`}
        actions={
          <>
            {canRelease ? (
              <Can permission="atw-dr.write">
                <ReleaseAtwButton id={doc.id} />
              </Can>
            ) : null}
            {canCreateSlip ? (
              <Can permission="withdrawal-slips.write">
                <PrimaryLink href={`/withdrawal-slips/new?atw_id=${doc.id}`}>Create withdrawal slip</PrimaryLink>
              </Can>
            ) : null}
            {doc.active_withdrawal_slip_id ? (
              <SecondaryLink href={`/withdrawal-slips/${doc.active_withdrawal_slip_id}`}>Withdrawal slip</SecondaryLink>
            ) : null}
            {canCancel ? (
              <Can permission="atw-dr.write">
                <CancelAtwButton id={doc.id} />
              </Can>
            ) : null}
            <SecondaryLink href={`/atw-dr/${doc.id}/print`}>Print</SecondaryLink>
            <SecondaryLink href="/atw-dr">Back</SecondaryLink>
          </>
        }
      />
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-eq-slate">
          <StatusBadge status={doc.status} />
          <span className="uppercase">{doc.document_type}</span>
          <span>{formatDate(doc.order_date)}</span>
          <span>Qty {formatQty(doc.total_quantity)}</span>
          <span>Grand total {formatMoney(doc.grand_total)}</span>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Invoice</dt>
            <dd className="mt-1 text-sm">
              <a className="text-eq-navy underline" href={`/invoices/${doc.invoice_id}`}>
                {doc.invoice_number || "Invoice"}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Sales order</dt>
            <dd className="mt-1 text-sm">
              <a className="text-eq-navy underline" href={`/sales-orders/${doc.sales_order_id}`}>
                {doc.so_number || "Sales order"}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Customer</dt>
            <dd className="mt-1 text-sm">{doc.customer_name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Delivery address</dt>
            <dd className="mt-1 text-sm">{doc.delivery_address ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Sales employee</dt>
            <dd className="mt-1 text-sm">{doc.sales_employee_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Term</dt>
            <dd className="mt-1 text-sm">{doc.term ?? "—"}</dd>
          </div>
        </dl>
        {doc.remarks ? <p className="mt-4 text-sm text-eq-slate">{doc.remarks}</p> : null}

        <h2 className="mt-6 text-sm font-semibold text-eq-ink">Lines</h2>
        <p className="mt-1 text-xs text-eq-slate">
          Prices are copied from the invoice. Invoice item quantity is snapshotted on the line.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-eq-slate">
              <tr>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Invoice qty</th>
                <th className="py-2 pr-3">This qty</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {doc.atw_document_items.map((line) => (
                <tr key={line.id} className="border-t border-eq-line">
                  <td className="py-2 pr-3">
                    <p>{line.description ?? line.model ?? "Item"}</p>
                    <p className="text-xs text-eq-slate">{[line.model, line.barcode].filter(Boolean).join(" · ") || line.uom}</p>
                  </td>
                  <td className="py-2 pr-3">
                    {formatQty(line.invoice_item_quantity)} {line.uom}
                  </td>
                  <td className="py-2 pr-3">
                    {formatQty(line.quantity)} {line.uom}
                  </td>
                  <td className="py-2 pr-3">{formatMoney(line.unit_price)}</td>
                  <td className="py-2">{formatMoney(line.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AuditFields
          createdAt={doc.created_at}
          createdByName={doc.created_by_name}
          updatedAt={doc.updated_at}
          updatedByName={doc.updated_by_name}
          cancelledAt={doc.cancelled_at}
          cancelledByName={doc.cancelled_by_name}
          cancellationReason={doc.cancellation_reason}
        />
      </Card>
    </>
  );
}
