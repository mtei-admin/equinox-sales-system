"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { lineAmount } from "@/lib/purchasing/quantities";
import { savePurchaseOrder } from "@/lib/purchasing/actions";
import { purchaseOrderSchema } from "@/lib/validation/schemas";
import { formatMoney, formatQty, todayIsoDate } from "@/lib/utils";
import type { ItemRow, PurchaseOrderItemRow, PurchaseOrderRow, SupplierRow } from "@/types/database";

type LineDraft = { item_id: string; ordered_qty: number; unit_cost: number; uom: string };

const emptyLine = (): LineDraft => ({ item_id: "", ordered_qty: 1, unit_cost: 0, uom: "PCS" });

export function PurchaseOrderForm({
  suppliers,
  items,
  order,
}: {
  suppliers: SupplierRow[];
  items: ItemRow[];
  order?: PurchaseOrderRow & { purchase_order_items: PurchaseOrderItemRow[] };
}) {
  const router = useRouter();
  const editing = Boolean(order);
  const [supplierId, setSupplierId] = useState(order?.supplier_id ?? "");
  const [poDate, setPoDate] = useState(order?.po_date?.slice(0, 10) ?? todayIsoDate());
  const [expected, setExpected] = useState(order?.expected_delivery_date?.slice(0, 10) ?? "");
  const [destination, setDestination] = useState(order?.destination ?? "");
  const [terms, setTerms] = useState(order?.payment_terms ?? "");
  const [reference, setReference] = useState(order?.supplier_reference ?? "");
  const [remarks, setRemarks] = useState(order?.remarks ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    order?.purchase_order_items.map((line) => ({
      item_id: line.item_id,
      ordered_qty: Number(line.ordered_qty),
      unit_cost: Number(line.unit_cost),
      uom: line.uom || "PCS",
    })) ?? [emptyLine()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const preview = useMemo(() => {
    return lines.map((line) => {
      try {
        return line.item_id ? lineAmount(line.ordered_qty, line.unit_cost) : 0;
      } catch {
        return 0;
      }
    });
  }, [lines]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function onSubmit() {
    setPending(true);
    setError(null);
    const payload = {
      supplier_id: supplierId,
      po_date: poDate,
      expected_delivery_date: expected,
      destination,
      payment_terms: terms,
      supplier_reference: reference,
      remarks,
      lines,
    };
    const parsed = purchaseOrderSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid purchase order");
      setPending(false);
      return;
    }
    const formData = new FormData();
    if (order) formData.set("id", order.id);
    formData.set("payload", JSON.stringify(parsed.data));
    const result = await savePurchaseOrder(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/purchase-orders/${result.id ?? order?.id}`);
    router.refresh();
  }

  return (
    <Card className="p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Supplier">
          <select className={inputClassName} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.supplier_code} — {supplier.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="PO date">
          <input className={inputClassName} type="date" value={poDate} onChange={(event) => setPoDate(event.target.value)} />
        </FormField>
        <FormField label="Expected delivery">
          <input className={inputClassName} type="date" value={expected} onChange={(event) => setExpected(event.target.value)} />
        </FormField>
        <FormField label="Destination">
          <input className={inputClassName} value={destination} onChange={(event) => setDestination(event.target.value)} />
        </FormField>
        <FormField label="Payment terms">
          <input className={inputClassName} value={terms} onChange={(event) => setTerms(event.target.value)} />
        </FormField>
        <FormField label="Supplier reference">
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
              <th className="py-2 pr-3">UOM</th>
              <th className="py-2 pr-3">Ordered qty</th>
              <th className="py-2 pr-3">Unit cost</th>
              <th className="py-2 pr-3">Amount</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="border-t border-eq-line">
                <td className="py-2 pr-3">
                  <select
                    className={inputClassName}
                    value={line.item_id}
                    onChange={(event) => updateLine(index, { item_id: event.target.value })}
                  >
                    <option value="">Select item</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.model ? ` · ${item.model}` : ""}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <input className={inputClassName} value={line.uom} onChange={(event) => updateLine(index, { uom: event.target.value })} />
                </td>
                <td className="py-2 pr-3">
                  <input
                    className={inputClassName}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.ordered_qty}
                    onChange={(event) => updateLine(index, { ordered_qty: Number(event.target.value) })}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    className={inputClassName}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unit_cost}
                    onChange={(event) => updateLine(index, { unit_cost: Number(event.target.value) })}
                  />
                </td>
                <td className="py-2 pr-3">{formatMoney(preview[index] ?? 0)}</td>
                <td className="py-2">
                  <button type="button" className="text-sm text-eq-slate underline" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-eq-slate">Preview total {formatMoney(preview.reduce((sum, amount) => sum + amount, 0))} · {formatQty(lines.reduce((sum, line) => sum + Number(line.ordered_qty || 0), 0))} qty. The server recalculates amount and status.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rounded-md border border-eq-line px-3.5 py-2 text-sm" onClick={() => setLines((current) => [...current, emptyLine()])}>
          Add line
        </button>
        <button type="button" disabled={pending} className="rounded-md bg-eq-navy px-3.5 py-2 text-sm text-white disabled:opacity-60" onClick={onSubmit}>
          {pending ? "Saving..." : editing ? "Save draft" : "Save draft"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </Card>
  );
}
