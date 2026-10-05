import { notFound } from "next/navigation";
import { Card, PageHeader, PrimaryLink, SecondaryLink } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { AuditFields } from "@/components/audit-fields";
import { BillOfLadingButton, CancelPurchasingButton } from "@/components/forms/purchasing-status-actions";
import { remainingToReceive } from "@/lib/purchasing/quantities";
import { getBillOfLading } from "@/lib/purchasing/queries";
import { formatDate, formatDateTime, formatQty } from "@/lib/utils";

const RECEIVE_OK = new Set(["posted", "in_transit", "arrived", "partially_received"]);

export default async function BillOfLadingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bill = await getBillOfLading(id);
  if (!bill) notFound();
  const po = bill.purchase_orders;
  const canReceive = RECEIVE_OK.has(bill.status) && bill.bill_of_lading_items.some((line) => remainingToReceive(Number(line.shipped_qty), Number(line.received_qty)) > 0);

  return (
    <>
      <PageHeader
        title={bill.bol_number}
        description={po ? `${po.supplier_name} · ${po.po_number}` : "Bill of lading"}
        actions={
          <>
            {bill.status === "draft" ? (
              <Can permission="bills-of-lading.write">
                <BillOfLadingButton id={bill.id} action="post" label="Post bill of lading" title="Post bill of lading" description="Posting adds these quantities to the purchase order shipped total. Stock does not change." />
              </Can>
            ) : null}
            {bill.status === "posted" ? (
              <Can permission="bills-of-lading.write">
                <BillOfLadingButton id={bill.id} action="transit" label="Mark in transit" title="Mark in transit" description="Records that the shipment has left. Stock does not change." />
              </Can>
            ) : null}
            {bill.status === "posted" || bill.status === "in_transit" ? (
              <Can permission="bills-of-lading.write">
                <BillOfLadingButton id={bill.id} action="arrived" label="Mark arrived" title="Mark arrived" description="Records arrival. Create a receiving report to add good quantity to stock." />
              </Can>
            ) : null}
            {canReceive ? (
              <Can permission="receiving-reports.write">
                <PrimaryLink href={`/bills-of-lading/${bill.id}/receiving/new`}>Create receiving report</PrimaryLink>
              </Can>
            ) : null}
            {bill.status !== "cancelled" ? (
              <Can permission="bills-of-lading.write">
                <CancelPurchasingButton id={bill.id} kind="bill-of-lading" />
              </Can>
            ) : null}
            <SecondaryLink href="/bills-of-lading">Back</SecondaryLink>
          </>
        }
      />
      <Card className="p-5">
        <div className="mb-4"><StatusBadge status={bill.status} /></div>
        <h2 className="text-sm font-semibold text-eq-ink">Shipment information</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-xs uppercase text-eq-slate">Supplier</dt><dd className="mt-1 text-sm">{po ? <a className="text-eq-navy underline" href={`/suppliers/${po.supplier_id}`}>{po.supplier_name}</a> : "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Purchase order</dt><dd className="mt-1 text-sm">{po ? <a className="text-eq-navy underline" href={`/purchase-orders/${po.id}`}>{po.po_number}</a> : "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Mode</dt><dd className="mt-1 text-sm">{bill.shipment_mode === "sea" ? "Sea shipment" : "Land delivery"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Shipment date</dt><dd className="mt-1 text-sm">{formatDate(bill.shipment_date)}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Expected arrival</dt><dd className="mt-1 text-sm">{formatDate(bill.expected_arrival_date)}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Carrier</dt><dd className="mt-1 text-sm">{bill.carrier ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Vessel / voyage</dt><dd className="mt-1 text-sm">{[bill.vessel_name, bill.voyage_number].filter(Boolean).join(" · ") || "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Container / seal</dt><dd className="mt-1 text-sm">{[bill.container_number, bill.seal_number].filter(Boolean).join(" · ") || "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Vehicle plate</dt><dd className="mt-1 text-sm">{bill.vehicle_plate_number ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Origin</dt><dd className="mt-1 text-sm">{bill.origin ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Destination</dt><dd className="mt-1 text-sm">{bill.destination ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-eq-slate">Reference</dt><dd className="mt-1 text-sm">{bill.reference_number ?? "—"}</dd></div>
        </dl>
        {bill.remarks ? <p className="mt-4 text-sm text-eq-slate">{bill.remarks}</p> : null}

        <h2 className="mt-6 text-sm font-semibold text-eq-ink">Items</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-eq-slate">
              <tr>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Shipped</th>
                <th className="py-2 pr-3">Received</th>
                <th className="py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {bill.bill_of_lading_items.map((line) => (
                <tr key={line.id} className="border-t border-eq-line">
                  <td className="py-2 pr-3">
                    <p>{line.item_name}</p>
                    <p className="text-xs text-eq-slate">{[line.model, line.barcode, line.uom].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="py-2 pr-3">{formatQty(line.shipped_qty)} {line.uom}</td>
                  <td className="py-2 pr-3">{formatQty(line.received_qty)}</td>
                  <td className="py-2">{formatQty(remainingToReceive(Number(line.shipped_qty), Number(line.received_qty)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-6 text-sm font-semibold text-eq-ink">Receiving reports</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {bill.reports.length === 0 ? <li className="text-eq-slate">None yet.</li> : bill.reports.map((report) => (
            <li key={report.id}>
              <a className="text-eq-navy underline" href={`/receiving-reports/${report.id}`}>{report.rr_number}</a>
              <span className="ml-2 text-eq-slate">{formatDate(report.receiving_date)}</span>
              <span className="ml-2"><StatusBadge status={report.status} /></span>
            </li>
          ))}
        </ul>
        <h2 className="mt-6 text-sm font-semibold text-eq-ink">History</h2>
        <ul className="mt-2 space-y-1 text-sm text-eq-slate">
          {bill.events.map((event) => (
            <li key={event.id}>{formatDateTime(event.created_at)} · {event.action}{event.new_status ? ` → ${event.new_status.replaceAll("_", " ")}` : ""}</li>
          ))}
        </ul>
        <AuditFields createdAt={bill.created_at} createdByName={null} updatedAt={bill.updated_at} updatedByName={null} cancelledAt={bill.cancelled_at} cancellationReason={bill.cancellation_reason} />
      </Card>
    </>
  );
}
