"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { headerTotals, invoiceLineTotals } from "@/lib/business/totals";
import { loadInvoiceSource, saveInvoice, type InvoiceSourceLine } from "@/lib/invoices/actions";
import { invoiceSchema } from "@/lib/validation/schemas";
import { formatMoney, formatQty } from "@/lib/utils";
import type { SalesOrderRow } from "@/types/database";

type DraftLine = InvoiceSourceLine & { quantity: number; tax_amount: number };

function toDraft(line: InvoiceSourceLine): DraftLine {
  return { ...line, quantity: line.remaining, tax_amount: 0 };
}

export function InvoiceForm({
  orders,
  initialSource,
  initialError,
}: {
  orders: SalesOrderRow[];
  initialSource: {
    sales_order_id: string;
    so_number: string;
    customer_name: string;
    remaining_qty: number;
    lines: InvoiceSourceLine[];
  } | null;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [soId, setSoId] = useState(initialSource?.sales_order_id ?? orders[0]?.id ?? "");
  const [customerName, setCustomerName] = useState(initialSource?.customer_name ?? "");
  const [lines, setLines] = useState<DraftLine[]>(initialSource?.lines.map(toDraft) ?? []);
  const [sourceError, setSourceError] = useState<string | null>(initialError ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingSo, startLoad] = useTransition();

  const selectedLines = lines.filter((line) => line.quantity > 0);
  const totals = useMemo(
    () =>
      headerTotals(
        selectedLines.map((line) => ({
          quantity: line.quantity,
          ...invoiceLineTotals(line.quantity, line.unit_price, line.tax_amount),
        })),
      ),
    [selectedLines],
  );

  function applySource(source: {
    sales_order_id: string;
    customer_name: string;
    lines: InvoiceSourceLine[];
  }) {
    setSoId(source.sales_order_id);
    setCustomerName(source.customer_name);
    setLines(source.lines.map(toDraft));
    setSourceError(null);
  }

  function onSoChange(id: string) {
    setSoId(id);
    setError(null);
    if (!id) {
      setLines([]);
      setCustomerName("");
      return;
    }
    startLoad(async () => {
      const result = await loadInvoiceSource(id);
      if (!result.ok) {
        setLines([]);
        setCustomerName("");
        setSourceError(result.error);
        return;
      }
      applySource(result);
    });
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const payload = {
      sales_order_id: soId,
      invoice_number: String(formData.get("invoice_number") || ""),
      remarks: String(formData.get("remarks") || ""),
      lines: selectedLines.map((line) => ({
        sales_order_item_id: line.sales_order_item_id,
        quantity: line.quantity,
        tax_amount: line.tax_amount,
      })),
    };
    const parsed = invoiceSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid invoice");
      setPending(false);
      return;
    }
    const body = new FormData();
    body.set("payload", JSON.stringify(parsed.data));
    const result = await saveInvoice(body);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/invoices/${result.id}`);
    router.refresh();
  }

  return (
    <Card className="p-5">
      <form action={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Pre-printed invoice number">
            <input className={inputClassName} name="invoice_number" required maxLength={40} />
          </FormField>
          <FormField label="Sales order">
            <select className={inputClassName} value={soId} onChange={(e) => onSoChange(e.target.value)} required>
              <option value="">Select an open sales order…</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.so_number} — {order.customer_name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        {customerName ? <p className="text-sm text-eq-slate">Customer snapshot: {customerName}</p> : null}
        {loadingSo ? <p className="text-sm text-eq-slate">Loading remaining quantities…</p> : null}
        {sourceError ? <p className="text-sm text-rose-700">{sourceError}</p> : null}

        {lines.length > 0 ? (
          <div>
            <h2 className="text-sm font-semibold text-eq-ink">Eligible lines</h2>
            <p className="mt-1 text-xs text-eq-slate">
              Quantity defaults to remaining. Reduce a line for a partial invoice, or set it to 0 to skip it. Multiple
              invoices can be created from the same sales order.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-eq-slate">
                  <tr>
                    <th className="pb-2 pr-2">Item</th>
                    <th className="pb-2 pr-2">Ordered</th>
                    <th className="pb-2 pr-2">Invoiced</th>
                    <th className="pb-2 pr-2">Remaining</th>
                    <th className="pb-2 pr-2">This invoice</th>
                    <th className="pb-2 pr-2">Tax</th>
                    <th className="pb-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const over = line.quantity > line.remaining + 1e-9;
                    const total =
                      line.quantity > 0 ? invoiceLineTotals(line.quantity, line.unit_price, line.tax_amount).total_amount : 0;
                    return (
                      <tr key={line.sales_order_item_id} className="align-top border-t border-eq-line">
                        <td className="py-2 pr-2">
                          <p>{line.description ?? line.model ?? "Item"}</p>
                          <p className="text-xs text-eq-slate">{formatMoney(line.unit_price)} / {line.uom}</p>
                        </td>
                        <td className="py-2 pr-2">{formatQty(line.ordered)}</td>
                        <td className="py-2 pr-2">{formatQty(line.invoiced)}</td>
                        <td className="py-2 pr-2">{formatQty(line.remaining)}</td>
                        <td className="py-2 pr-2 w-28">
                          <input
                            className={inputClassName}
                            type="number"
                            min="0"
                            max={line.remaining}
                            step="0.01"
                            value={line.quantity}
                            onChange={(e) =>
                              setLines((current) =>
                                current.map((row, i) => (i === index ? { ...row, quantity: Number(e.target.value) } : row)),
                              )
                            }
                          />
                          {over ? <p className="mt-1 text-xs text-rose-700">Exceeds remaining</p> : null}
                        </td>
                        <td className="py-2 pr-2 w-28">
                          <input
                            className={inputClassName}
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.tax_amount}
                            onChange={(e) =>
                              setLines((current) =>
                                current.map((row, i) => (i === index ? { ...row, tax_amount: Number(e.target.value) } : row)),
                              )
                            }
                          />
                        </td>
                        <td className="py-2 whitespace-nowrap">{formatMoney(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <FormField label="Remarks">
          <textarea className={inputClassName} name="remarks" rows={2} />
        </FormField>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-eq-line pt-4">
          <div className="text-sm">
            <p>Invoice qty {formatQty(totals.total_quantity)}</p>
            <p className="font-semibold text-eq-ink">Grand total {formatMoney(totals.grand_total)}</p>
          </div>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <button type="submit" disabled={pending || !soId || selectedLines.length === 0} className="rounded-md bg-eq-navy px-4 py-2 text-sm text-white disabled:opacity-60">
            {pending ? "Saving…" : "Save draft"}
          </button>
        </div>
      </form>
    </Card>
  );
}