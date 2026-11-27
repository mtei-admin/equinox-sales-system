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
  const [containerCount, setContainerCount] = useState("");
  const [plate, setPlate] = useState("");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState(destination ?? "");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(openLines.map((row) => [row.line.id, String(row.remaining)])),
  );
  const [omitted, setOmitted] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setPending(true);
    setError(null);
    const selected = openLines.filter((row) => !omitted.includes(row.line.id));
    if (selected.length === 0) {
      setError("Bill of lading needs at least one item");
      setPending(false);
      return;
    }
    const blank = selected.find((row) => (qty[row.line.id] ?? "").trim() === "");
    if (blank) {
      setError(`Shipped quantity is required for ${blank.line.item_name}`);
      setPending(false);
      return;
    }
    const invalid = selected.find((row) => {
      const value = Number(qty[row.line.id]);
      return !Number.isFinite(value) || value <= 0;
    });
    if (invalid) {
      setError(`Shipped quantity must be greater than 0 for ${invalid.line.item_name}`);
      setPending(false);
      return;
    }
    const payload = {
      purchase_order_id: purchaseOrderId,
      shipment_mode: mode,
      shipment_date: shipmentDate,
      expected_arrival_date: arrival,
      carrier,
      vessel_name: vessel,
      voyage_number: voyage,
      container_count: containerCount,
      vehicle_plate_number: plate,
      origin,
      destination: dest,
      reference_number: reference,
      remarks,
      lines: selected.map((row) => ({
        purchase_order_item_id: row.line.id,
        shipped_qty: Number(qty[row.line.id]),
      })),
    };
    const parsed = billOfLadingSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid bill of lading");
      setPending(false);
      return;
    }
    const over = selected.find((row) => Number(qty[row.line.id]) > row.remaining);
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
            <FormField label="Number of containers">
              <input className={inputClassName} type="number" min="1" step="1" value={containerCount} onChange={(event) => setContainerCount(event.target.value)} />
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
            {openLines.filter((row) => !omitted.includes(row.line.id)).map(({ line, remaining }) => (
              <tr key={line.id} className="border-t border-eq-line">
                <td className="py-2 pr-3">
                  <p>{line.item_name}</p>
                  <p className="text-xs text-eq-slate">{[line.model, line.barcode, line.uom].filter(Boolean).join(" · ")}</p>
                </td>
                <td className="py-2 pr-3">{formatQty(line.ordered_qty)}</td>
                <td className="py-2 pr-3">{formatQty(line.shipped_qty)}</td>
                <td className="py-2 pr-3">{formatQty(remaining)}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <input
                      className={inputClassName}
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      max={remaining}
                      value={qty[line.id] ?? ""}
                      onChange={(event) => setQty((current) => ({ ...current, [line.id]: event.target.value }))}
                    />
                    <button
                      type="button"
                      className="text-sm text-eq-slate underline"
                      onClick={() => setOmitted((current) => [...current, line.id])}
                    >
                      Remove
                    </button>
                  </div>
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
