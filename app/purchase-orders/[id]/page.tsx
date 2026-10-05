import { notFound } from "next/navigation";
import { Card, PageHeader, PrimaryLink, SecondaryLink } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { AuditFields } from "@/components/audit-fields";
import {
  CancelPurchasingButton,
  PurchaseOrderButton,
} from "@/components/forms/purchasing-status-actions";
import { remainingToReceive, remainingToShip } from "@/lib/purchasing/quantities";
import { getPurchaseOrder } from "@/lib/purchasing/queries";
import { formatDate, formatDateTime, formatMoney, formatQty } from "@/lib/utils";

const BOL_OK = new Set(["approved", "partially_shipped", "fully_shipped", "partially_received"]);

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getPurchaseOrder(id);
  if (!order) notFound();
  const lines = order.purchase_order_items;
  const ordered = lines.reduce((sum, line) => sum + Number(line.ordered_qty), 0);
  const shipped = lines.reduce((sum, line) => sum + Number(line.shipped_qty), 0);
  const received = lines.reduce((sum, line) => sum + Number(line.received_qty), 0);
  const canBol = BOL_OK.has(order.status) && lines.some((line) => remainingToShip(Number(line.ordered_qty), Number(line.shipped_qty)) > 0);

  return (
    <>
      <PageHeader
        title={order.po_number}
        description={order.supplier_name}
        actions={
          <>
            {order.status === "draft" ? (
              <Can permission="purchase-orders.write">
                <SecondaryLink href={`/purchase-orders/${order.id}/edit`}>Edit</SecondaryLink>
                <PurchaseOrderButton id={order.id} action="submit" label="Submit for approval" title="Submit purchase order" description="The purchase order leaves draft and waits for approval. Stock does not change." />
              </Can>
            ) : null}
            {order.status === "for_approval" ? (
              <Can permission="purchase-orders.write">
                <PurchaseOrderButton id={order.id} action="approve" label="Approve" title="Approve purchase order" description="Approval allows bills of lading. It does not increase inventory." />
              </Can>
            ) : null}
            {canBol ? (
              <Can permission="bills-of-lading.write">
                <PrimaryLink href={`/purchase-orders/${order.id}/bills/new`}>Create bill of lading</PrimaryLink>
              </Can>
            ) : null}
            {["approved", "partially_shipped", "fully_shipped", "partially_received", "completed"].includes(order.status) ? (
              <Can permission="purchase-orders.write">
                <PurchaseOrderButton id={order.id} action="close" label="Close" title="Close purchase order" description="A closed purchase order cannot create new bills of lading or receiving reports." />
              </Can>
            ) : null}
            {!["cancelled", "closed"].includes(order.status) ? (
              <Can permission="purchase-orders.write">
                <CancelPurchasingButton id={order.id} kind="purchase-order" />
              </Can>
            ) : null}
            <SecondaryLink href="/purchase-orders">Back</SecondaryLink>
          </>
        }
      />
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-eq-slate">
          <StatusBadge status={order.status} />
          <span>{formatDate(order.po_date)}</span>
          <span>Amount {formatMoney(order.grand_total)}</span>
        </div>
        <h2 className="text-sm font-semibold text-eq-ink">Overview</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Supplier</dt>
            <dd className="mt-1 text-sm"><a className="text-eq-navy underline" href={`/suppliers/${order.supplier_id}`}>{order.supplier_code} · {order.supplier_name}</a></dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Expected delivery</dt>
            <dd className="mt-1 text-sm">{formatDate(order.expected_delivery_date)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Destination</dt>
            <dd className="mt-1 text-sm">{order.destination ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Payment terms</dt>
            <dd className="mt-1 text-sm">{order.payment_terms ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Supplier reference</dt>
            <dd className="mt-1 text-sm">{order.supplier_reference ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-eq-slate">Approved</dt>
            <dd className="mt-1 text-sm">{formatDateTime(order.approved_at)}</dd>
          </div>
        </dl>
        <dl className="mt-4 grid gap-3 sm:grid-cols-5 text-sm">
          <div><dt className="text-xs uppercase text-eq-slate">Ordered</dt><dd>{formatQty(ordered)}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Shipped</dt><dd>{formatQty(shipped)}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Received</dt><dd>{formatQty(received)}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Balance to ship</dt><dd>{formatQty(remainingToShip(ordered, shipped))}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Balance to receive</dt><dd>{formatQty(remainingToReceive(ordered, received))}</dd></div>
        </dl>
        {order.remarks ? <p className="mt-4 text-sm text-eq-slate">{order.remarks}</p> : null}
        {order.cancellation_reason ? <p className="mt-2 text-sm text-eq-slate">Cancelled: {order.cancellation_reason}</p> : null}

        <h2 className="mt-6 text-sm font-semibold text-eq-ink">Items</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-eq-slate">
              <tr>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">UOM</th>
                <th className="py-2 pr-3">Ordered</th>
                <th className="py-2 pr-3">Shipped</th>
                <th className="py-2 pr-3">Received</th>
                <th className="py-2 pr-3">To ship</th>
                <th className="py-2 pr-3">To receive</th>
                <th className="py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t border-eq-line">
                  <td className="py-2 pr-3">
                    <p>{line.item_name}</p>
                    <p className="text-xs text-eq-slate">{[line.model, line.barcode].filter(Boolean).join(" · ") || "—"}</p>
                  </td>
                  <td className="py-2 pr-3">{line.uom}</td>
                  <td className="py-2 pr-3">{formatQty(line.ordered_qty)}</td>
                  <td className="py-2 pr-3">{formatQty(line.shipped_qty)}</td>
                  <td className="py-2 pr-3">{formatQty(line.received_qty)}</td>
                  <td className="py-2 pr-3">{formatQty(remainingToShip(Number(line.ordered_qty), Number(line.shipped_qty)))}</td>
                  <td className="py-2 pr-3">{formatQty(remainingToReceive(Number(line.ordered_qty), Number(line.received_qty)))}</td>
                  <td className="py-2">{formatMoney(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-6 text-sm font-semibold text-eq-ink">Bills of lading</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {order.bills.length === 0 ? <li className="text-eq-slate">None yet.</li> : order.bills.map((bill) => (
            <li key={bill.id}>
              <a className="text-eq-navy underline" href={`/bills-of-lading/${bill.id}`}>{bill.bol_number}</a>
              <span className="ml-2 text-eq-slate">{formatDate(bill.shipment_date)}</span>
              <span className="ml-2"><StatusBadge status={bill.status} /></span>
            </li>
          ))}
        </ul>

        <h2 className="mt-6 text-sm font-semibold text-eq-ink">Receiving reports</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {order.reports.length === 0 ? <li className="text-eq-slate">None yet.</li> : order.reports.map((report) => (
            <li key={report.id}>
              <a className="text-eq-navy underline" href={`/receiving-reports/${report.id}`}>{report.rr_number}</a>
              <span className="ml-2 text-eq-slate">{formatDate(report.receiving_date)}</span>
              <span className="ml-2"><StatusBadge status={report.status} /></span>
            </li>
          ))}
        </ul>

        <h2 className="mt-6 text-sm font-semibold text-eq-ink">History</h2>
        <ul className="mt-2 space-y-1 text-sm text-eq-slate">
          {order.events.length === 0 ? <li>No events yet.</li> : order.events.map((event) => (
            <li key={event.id}>{formatDateTime(event.created_at)} · {event.action}{event.new_status ? ` → ${event.new_status.replaceAll("_", " ")}` : ""}{event.remarks ? ` · ${event.remarks}` : ""}</li>
          ))}
        </ul>
        <AuditFields createdAt={order.created_at} createdByName={null} updatedAt={order.updated_at} updatedByName={null} cancelledAt={order.cancelled_at} cancellationReason={order.cancellation_reason} />
      </Card>
    </>
  );
}
