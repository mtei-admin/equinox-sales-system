"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { remainingToShip } from "@/lib/purchasing/quantities";
import { saveBillOfLading } from "@/lib/purchasing/actions";
import { billOfLadingSchema } from "@/lib/validation/schemas";
import { formatQty, todayIsoDate } from "@/lib/utils";
import type { PurchaseOrderItemRow } from "@/types/database";

export function BillOfLadingForm({
  purchaseOrderId,
  destination,
  lines,
}: {
  purchaseOrderId: string;
  destination: string | null;
  lines: PurchaseOrderItemRow[];
}) {
  const router = useRouter();
  const openLines = lines
    .map((line) => ({ line, remaining: remainingToShip(Number(line.ordered_qty), Number(line.shipped_qty)) }))
    .filter((row) => row.remaining > 0);
  const [mode, setMode] = useState<"sea" | "land">("land");
  const [shipmentDate, setShipmentDate] = useState(todayIsoDate());
  const [arrival, setArrival] = useState("");
  const [carrier, setCarrier] = useState("");
  const [vessel, setVessel] = useState("");
  const [voyage, setVoyage] = useState("");
  const [container, setContainer] = useState("");
  const [seal, setSeal] = useState("");
  const [plate, setPlate] = useState("");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState(destination ?? "");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(openLines.map((row) => [row.line.id, row.remaining])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setPending(true);
    setError(null);
    const payload = {
      purchase_order_id: purchaseOrderId,
      shipment_mode: mode,
      shipment_date: shipmentDate,
      expected_arrival_date: arrival,
      carrier,
      vessel_name: vessel,
      voyage_number: voyage,
      container_number: container,
      seal_number: seal,
      vehicle_plate_number: plate,
      origin,
      destination: dest,
      reference_number: reference,
      remarks,
      lines: openLines.map((row) => ({
        purchase_order_item_id: row.line.id,
        shipped_qty: Number(qty[row.line.id] ?? 0),
      })),
    };
    const parsed = billOfLadingSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid bill of lading");
      setPending(false);
      return;
    }
    if (!parsed.data.lines.some((line) => line.shipped_qty > 0)) {
      setError("Enter a shipped quantity for at least one item");
      setPending(false);
      return;
    }
    const over = openLines.find((row) => Number(qty[row.line.id] ?? 0) > row.remaining);
    if (over) {
      setError("Requested shipment quantity exceeds the remaining PO quantity.");
      setPending(false);
      return;
    }
    const formData = new FormData();
    formData.set("payload", JSON.stringify(parsed.data));
    const result = await saveBillOfLading(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/bills-of-lading/${result.id}`);
    router.refresh();
  }

  if (openLines.length === 0) {
    return <Card className="p-5 text-sm text-eq-slate">Purchase Order has already been fully shipped.</Card>;
  }

  return (
    <Card className="p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Shipment">
          <select className={inputClassName} value={mode} onChange={(event) => setMode(event.target.value as "sea" | "land")}>
            <option value="land">Land delivery</option>
            <option value="sea">Sea shipment</option>
          </select>
        </FormField>
        <FormField label="Shipment date">
          <input className={inputClassName} type="date" value={shipmentDate} onChange={(event) => setShipmentDate(event.target.value)} />
        </FormField>
        <FormField label="Expected arrival">
          <input className={inputClassName} type="date" value={arrival} onChange={(event) => setArrival(event.target.value)} />
        </FormField>
        <FormField label="Carrier">
          <input className={inputClassName} value={carrier} onChange={(event) => setCarrier(event.target.value)} />
        </FormField>
        {mode === "sea" ? (
          <>
            <FormField label="Vessel">
              <input className={inputClassName} value={vessel} onChange={(event) => setVessel(event.target.value)} />
            </FormField>
            <FormField label="Voyage">
              <input className={inputClassName} value={voyage} onChange={(event) => setVoyage(event.target.value)} />
            </FormField>
            <FormField label="Container">
              <input className={inputClassName} value={container} onChange={(event) => setContainer(event.target.value)} />
            </FormField>
            <FormField label="Seal">
              <input className={inputClassName} value={seal} onChange={(event) => setSeal(event.target.value)} />
            </FormField>
          </>
        ) : (
          <FormField label="Vehicle plate">
            <input className={inputClassName} value={plate} onChange={(event) => setPlate(event.target.value)} />
          </FormField>
        )}
        <FormField label="Origin">
          <input className={inputClassName} value={origin} onChange={(event) => setOrigin(event.target.value)} />
        </FormField>
        <FormField label="Destination">
          <input className={inputClassName} value={dest} onChange={(event) => setDest(event.target.value)} />
        </FormField>
        <FormField label="Reference">
          <input className={inputClassName} value={reference} onChange={(event) => setReference(event.target.value)} />
        </FormField>
        <div className="md:col-span-2">
          <FormField label="Remarks">
            <textarea className={inputClassName} rows={2} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
          </FormField>
        </div>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-eq-slate">
            <tr>
              <th className="py-2 pr-3">Item</th>
              <th className="py-2 pr-3">Ordered</th>
              <th className="py-2 pr-3">Previously shipped</th>
              <th className="py-2 pr-3">Remaining to ship</th>
              <th className="py-2">Current shipped qty</th>
            </tr>
          </thead>
          <tbody>
            {openLines.map(({ line, remaining }) => (
              <tr key={line.id} className="border-t border-eq-line">
                <td className="py-2 pr-3">
                  <p>{line.item_name}</p>
                  <p className="text-xs text-eq-slate">{[line.model, line.barcode, line.uom].filter(Boolean).join(" · ")}</p>
                </td>
                <td className="py-2 pr-3">{formatQty(line.ordered_qty)}</td>
                <td className="py-2 pr-3">{formatQty(line.shipped_qty)}</td>
                <td className="py-2 pr-3">{formatQty(remaining)}</td>
                <td className="py-2">
                  <input
                    className={inputClassName}
                    type="number"
                    min="0"
                    step="0.01"
                    max={remaining}
                    value={qty[line.id] ?? 0}
                    onChange={(event) => setQty((current) => ({ ...current, [line.id]: Number(event.target.value) }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" disabled={pending} className="mt-4 rounded-md bg-eq-navy px-3.5 py-2 text-sm text-white disabled:opacity-60" onClick={onSubmit}>
        {pending ? "Saving..." : "Save draft bill of lading"}
      </button>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </Card>
  );
}
