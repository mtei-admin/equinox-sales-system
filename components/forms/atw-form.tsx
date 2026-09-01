"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { headerTotals, soLineTotals } from "@/lib/business/totals";
import { loadAtwSource, saveAtw, type AtwSourceLine } from "@/lib/atw/actions";
import { atwSchema } from "@/lib/validation/schemas";
import { formatMoney, formatQty } from "@/lib/utils";
import type { InvoiceRow } from "@/types/database";

type DraftLine = AtwSourceLine & { quantity: number };

function toDraft(line: AtwSourceLine): DraftLine {
  return { ...line, quantity: line.remaining };
}

export function AtwForm({
  invoices,
  initialSource,
  initialError,
  initialType = "atw",
}: {
  invoices: InvoiceRow[];
  initialSource: {
    invoice_id: string;
    invoice_number: string;
    customer_name: string;
    remaining_qty: number;
    lines: AtwSourceLine[];
  } | null;
  initialError?: string | null;
  initialType?: "atw" | "dr";
}) {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = useState(initialSource?.invoice_id ?? invoices[0]?.id ?? "");
  const [customerName, setCustomerName] = useState(initialSource?.customer_name ?? "");
  const [lines, setLines] = useState<DraftLine[]>(initialSource?.lines.map(toDraft) ?? []);
  const [sourceError, setSourceError] = useState<string | null>(initialError ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingInvoice, startLoad] = useTransition();

  const selectedLines = lines.filter((line) => line.quantity > 0);
  const totals = useMemo(
    () =>
      headerTotals(
        selectedLines.map((line) => ({
          quantity: line.quantity,
          total_amount: soLineTotals(line.quantity, line.unit_price).total_amount,
        })),
      ),
    [selectedLines],
  );

  function applySource(source: { invoice_id: string; customer_name: string; lines: AtwSourceLine[] }) {
    setInvoiceId(source.invoice_id);
    setCustomerName(source.customer_name);
    setLines(source.lines.map(toDraft));
    setSourceError(null);
  }

  function onInvoiceChange(id: string) {
    setInvoiceId(id);
    setError(null);
    if (!id) {
      setLines([]);
      setCustomerName("");
      return;
    }
    startLoad(async () => {
      const result = await loadAtwSource(id);
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
      invoice_id: invoiceId,
      document_type: String(formData.get("document_type") || "atw"),
      remarks: String(formData.get("remarks") || ""),
      lines: selectedLines.map((line) => ({
        invoice_item_id: line.invoice_item_id,
        quantity: line.quantity,
      })),
    };
    const parsed = atwSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid ATW/DR");
      setPending(false);
      return;
    }
    const body = new FormData();
    body.set("payload", JSON.stringify(parsed.data));
    const result = await saveAtw(body);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/atw-dr/${result.id}`);
    router.refresh();
  }

  return (
    <Card className="p-5">
      <form action={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Document type">
            <select className={inputClassName} name="document_type" defaultValue={initialType}>
              <option value="atw">ATW</option>
              <option value="dr">Delivery Receipt</option>
            </select>
          </FormField>
          <FormField label="Posted invoice">
            <select className={inputClassName} value={invoiceId} onChange={(e) => onInvoiceChange(e.target.value)} required>
              <option value="">Select a posted invoice…</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} — {invoice.customer_name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        {customerName ? <p className="text-sm text-eq-slate">Customer snapshot: {customerName}</p> : null}
        {loadingInvoice ? <p className="text-sm text-eq-slate">Loading remaining quantities…</p> : null}
        {sourceError ? <p className="text-sm text-rose-700">{sourceError}</p> : null}

        {lines.length > 0 ? (
          <div>
            <h2 className="text-sm font-semibold text-eq-ink">Eligible lines</h2>
            <p className="mt-1 text-xs text-eq-slate">
              Quantity defaults to remaining. Reduce a line for a partial ATW/DR, or set it to 0 to skip it. Multiple
              ATW/DR documents can be created from the same invoice.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-eq-slate">
                  <tr>
                    <th className="pb-2 pr-2">Item</th>
                    <th className="pb-2 pr-2">Invoiced</th>
                    <th className="pb-2 pr-2">Allocated</th>
                    <th className="pb-2 pr-2">Remaining</th>
                    <th className="pb-2 pr-2">This document</th>
                    <th className="pb-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const over = line.quantity > line.remaining + 1e-9;
                    const amount = line.quantity > 0 ? soLineTotals(line.quantity, line.unit_price).amount : 0;
                    return (
                      <tr key={line.invoice_item_id} className="align-top border-t border-eq-line">
                        <td className="py-2 pr-2">
                          <p>{line.description ?? line.model ?? "Item"}</p>
                          <p className="text-xs text-eq-slate">
                            {formatMoney(line.unit_price)} / {line.uom}
                          </p>
                        </td>
                        <td className="py-2 pr-2">{formatQty(line.invoiced)}</td>
                        <td className="py-2 pr-2">{formatQty(line.allocated)}</td>
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
                        <td className="py-2 whitespace-nowrap">{formatMoney(amount)}</td>
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
            <p>ATW/DR qty {formatQty(totals.total_quantity)}</p>
            <p className="font-semibold text-eq-ink">Grand total {formatMoney(totals.grand_total)}</p>
          </div>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <button
            type="submit"
            disabled={pending || !invoiceId || selectedLines.length === 0}
            className="rounded-md bg-eq-navy px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save draft"}
          </button>
        </div>
      </form>
    </Card>
  );
}
