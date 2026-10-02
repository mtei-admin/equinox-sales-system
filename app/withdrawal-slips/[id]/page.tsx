import { notFound } from "next/navigation";
import { Card, PageHeader, PrimaryLink, SecondaryLink } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { AuditFields } from "@/components/audit-fields";
import { Can } from "@/components/can";
import { CancelWithdrawalSlipButton, IssueWithdrawalSlipButton } from "@/components/forms/withdrawal-slip-status-actions";
import { getWithdrawalSlip } from "@/lib/data/queries";
import { formatDate, formatMoney, formatQty } from "@/lib/utils";

export default async function WithdrawalSlipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slip = await getWithdrawalSlip(id);
  if (!slip) notFound();
  const canIssue = slip.status === "draft";
  const canEdit = slip.status === "draft";
  const canCancel = slip.status !== "cancelled";
  const typeLabel = slip.document_type === "dr" ? "Delivery Receipt" : "ATW";

  return (
    <>
      <PageHeader
        title={slip.ws_number}
        description={slip.customer_name}
        actions={
          <>
            {canEdit ? (
              <Can permission="withdrawal-slips.write">
                <PrimaryLink href={`/withdrawal-slips/${slip.id}/edit`}>Edit</PrimaryLink>
              </Can>
            ) : null}
            {canIssue ? (
              <Can permission="withdrawal-slips.write">
                <IssueWithdrawalSlipButton id={slip.id} />
              </Can>
            ) : null}
            {canCancel ? (
              <Can permission="withdrawal-slips.write">
                <CancelWithdrawalSlipButton id={slip.id} />
              </Can>
            ) : null}
            <SecondaryLink href={`/withdrawal-slips/${slip.id}/print`}>Print</SecondaryLink>
            <SecondaryLink href="/withdrawal-slips">Back</SecondaryLink>
          </>
        }
      />
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-eq-slate">
          <StatusBadge status={slip.status} />
          <span>{formatDate(slip.order_date)}</span>
          <span>Qty {formatQty(slip.total_quantity)}</span>
          <span>Grand total {formatMoney(slip.grand_total)}</span>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">{typeLabel}</dt>
            <dd className="mt-1 text-sm">
              <a className="text-eq-navy underline" href={`/atw-dr/${slip.atw_id}`}>
                {slip.atw_number || "ATW/DR"}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Invoice</dt>
            <dd className="mt-1 text-sm">
              <a className="text-eq-navy underline" href={`/invoices/${slip.invoice_id}`}>
                {slip.invoice_number || "Invoice"}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Sales order</dt>
            <dd className="mt-1 text-sm">
              <a className="text-eq-navy underline" href={`/sales-orders/${slip.sales_order_id}`}>
                {slip.so_number || "Sales order"}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Customer</dt>
            <dd className="mt-1 text-sm">{slip.customer_name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Delivery address</dt>
            <dd className="mt-1 text-sm">{slip.delivery_address ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Sales employee</dt>
            <dd className="mt-1 text-sm">{slip.sales_employee_name ?? "—"}</dd>
          </div>
        </dl>
        {slip.remarks ? <p className="mt-4 text-sm text-eq-slate">{slip.remarks}</p> : null}

        <h2 className="mt-6 text-sm font-semibold text-eq-ink">Lines</h2>
        <p className="mt-1 text-xs text-eq-slate">Quantities are copied from the ATW/DR and cannot differ.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-eq-slate">
              <tr>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Qty</th>
                <th className="py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {slip.withdrawal_slip_items.map((line) => (
                <tr key={line.id} className="border-t border-eq-line">
                  <td className="py-2 pr-3">
                    <p>{line.description ?? line.model ?? "Item"}</p>
                    <p className="text-xs text-eq-slate">{[line.model, line.barcode].filter(Boolean).join(" · ") || line.uom}</p>
                  </td>
                  <td className="py-2 pr-3">
                    {formatQty(line.quantity)} {line.uom}
                  </td>
                  <td className="py-2">{formatMoney(line.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AuditFields
          createdAt={slip.created_at}
          createdByName={slip.created_by_name}
          updatedAt={slip.updated_at}
          updatedByName={slip.updated_by_name}
          cancelledAt={slip.cancelled_at}
          cancelledByName={slip.cancelled_by_name}
          cancellationReason={slip.cancellation_reason}
        />
      </Card>
    </>
  );
}
