import { notFound } from "next/navigation";
import { Card, PageHeader, SecondaryLink } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { AuditFields } from "@/components/audit-fields";
import { CancelPurchasingButton, PostReceivingButton, ResolveDiscrepancyForm } from "@/components/forms/purchasing-status-actions";
import { getReceivingReport } from "@/lib/purchasing/queries";
import { formatDate, formatDateTime, formatQty } from "@/lib/utils";

function flags(shortQty: number, damagedQty: number, excessQty: number) {
  const labels: string[] = [];
  if (shortQty > 0) labels.push("SHORT");
  if (damagedQty > 0) labels.push("DAMAGED");
  if (excessQty > 0) labels.push("EXCESS");
  return labels;
}

export default async function ReceivingReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReceivingReport(id);
  if (!report) notFound();
  const po = report.purchase_orders;
  const bol = report.bills_of_lading;

  return (
    <>
      <PageHeader
        title={report.rr_number}
        description={[po?.supplier_name, po?.po_number, bol?.bol_number].filter(Boolean).join(" · ")}
        actions={
          <>
            {report.status === "draft" ? (
              <Can permission="receiving-reports.write">
                <PostReceivingButton id={report.id} />
              </Can>
            ) : null}
            {report.status === "posted" ? (
              <Can permission="receiving-reports.write">
                <CancelPurchasingButton id={report.id} kind="receiving-report" />
              </Can>
            ) : null}
            <SecondaryLink href="/receiving-reports">Back</SecondaryLink>
          </>
        }
      />
      <Card className="p-5">
        <div className="mb-4"><StatusBadge status={report.status} /></div>
        <h2 className="text-sm font-semibold text-eq-ink">Receiving information</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-xs uppercase text-eq-slate">Supplier</dt><dd className="mt-1 text-sm">{po ? <a className="text-eq-navy underline" href={`/suppliers/${po.supplier_id}`}>{po.supplier_name}</a> : "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">PO number</dt><dd className="mt-1 text-sm">{po ? <a className="text-eq-navy underline" href={`/purchase-orders/${po.id}`}>{po.po_number}</a> : "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">BOL number</dt><dd className="mt-1 text-sm">{bol ? <a className="text-eq-navy underline" href={`/bills-of-lading/${bol.id}`}>{bol.bol_number}</a> : "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Receiving date</dt><dd className="mt-1 text-sm">{formatDate(report.receiving_date)}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Delivery receipt</dt><dd className="mt-1 text-sm">{report.delivery_receipt_number ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Supplier invoice</dt><dd className="mt-1 text-sm">{report.supplier_invoice_number ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Received by</dt><dd className="mt-1 text-sm">{report.received_by_name ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Checked by</dt><dd className="mt-1 text-sm">{report.checked_by_name ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Weights</dt><dd className="mt-1 text-sm">{report.net_weight != null ? `Net ${formatQty(report.net_weight)} (gross ${formatQty(report.gross_weight ?? 0)} − tare ${formatQty(report.tare_weight ?? 0)})` : "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Weighbridge ticket</dt><dd className="mt-1 text-sm">{report.weighbridge_ticket ?? "—"}</dd></div>
        </dl>
        {report.remarks ? <p className="mt-4 text-sm text-eq-slate">{report.remarks}</p> : null}

        <h2 className="mt-6 text-sm font-semibold text-eq-ink">Items</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-eq-slate">
              <tr>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Expected</th>
                <th className="py-2 pr-3">Actual</th>
                <th className="py-2 pr-3">Good</th>
                <th className="py-2 pr-3">Damaged</th>
                <th className="py-2 pr-3">Short</th>
                <th className="py-2 pr-3">Excess</th>
                <th className="py-2">Flags</th>
              </tr>
            </thead>
            <tbody>
              {report.receiving_report_items.map((line) => {
                const expected = Number(line.shipped_qty) - Number(line.previously_received_qty);
                const labels = flags(Number(line.short_qty), Number(line.damaged_qty), Number(line.excess_qty));
                const discs = report.discrepancies.filter((row) => row.receiving_report_item_id === line.id);
                return (
                  <tr key={line.id} className="border-t border-eq-line align-top">
                    <td className="py-2 pr-3">
                      <p>{line.item_name}</p>
                      <p className="text-xs text-eq-slate">{line.uom}</p>
                      {line.remarks ? <p className="text-xs text-eq-slate">{line.remarks}</p> : null}
                    </td>
                    <td className="py-2 pr-3">{formatQty(expected)}</td>
                    <td className="py-2 pr-3">{formatQty(line.actual_received_qty)}</td>
                    <td className="py-2 pr-3">{formatQty(line.good_qty)}</td>
                    <td className="py-2 pr-3">{formatQty(line.damaged_qty)}</td>
                    <td className="py-2 pr-3">{formatQty(line.short_qty)}</td>
                    <td className="py-2 pr-3">{formatQty(line.excess_qty)}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {labels.length === 0 ? <span className="text-eq-slate">—</span> : labels.map((label) => (
                          <span key={label} className="rounded border border-eq-line px-1.5 py-0.5 text-xs font-medium">{label}</span>
                        ))}
                      </div>
                      {discs.map((disc) => (
                        <div key={disc.id} className="mt-2 text-xs">
                          <p>{disc.discrepancy_type.toUpperCase()} · {disc.status.replaceAll("_", " ")} · {formatQty(disc.quantity)}</p>
                          {disc.status === "open" && report.status === "posted" ? (
                            <Can permission="receiving-reports.write">
                              <ResolveDiscrepancyForm id={disc.id} reportId={report.id} />
                            </Can>
                          ) : disc.resolution_remarks ? <p className="text-eq-slate">{disc.resolution_remarks}</p> : null}
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h2 className="mt-6 text-sm font-semibold text-eq-ink">Inventory posting</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {report.movements.length === 0 ? <li className="text-eq-slate">No stock movement until this report is posted.</li> : report.movements.map((movement) => (
            <li key={movement.id}>
              <a className="text-eq-navy underline" href="/inventory">{movement.reverses_movement_id ? "Reversal" : "Receipt"} {formatQty(Number(movement.quantity))}</a>
            </li>
          ))}
        </ul>
        <h2 className="mt-6 text-sm font-semibold text-eq-ink">History</h2>
        <ul className="mt-2 space-y-1 text-sm text-eq-slate">
          {report.events.map((event) => (
            <li key={event.id}>{formatDateTime(event.created_at)} · {event.action}{event.new_status ? ` → ${event.new_status.replaceAll("_", " ")}` : ""}{event.remarks ? ` · ${event.remarks}` : ""}</li>
          ))}
        </ul>
        <AuditFields createdAt={report.created_at} createdByName={null} updatedAt={report.updated_at} updatedByName={null} cancelledAt={report.cancelled_at} cancellationReason={report.cancellation_reason} />
      </Card>
    </>
  );
}
