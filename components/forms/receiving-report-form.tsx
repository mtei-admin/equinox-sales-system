"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { receivingFigures, remainingToReceive } from "@/lib/purchasing/quantities";
import { saveReceivingReport } from "@/lib/purchasing/actions";
import { receivingReportSchema } from "@/lib/validation/schemas";
import { formatQty, todayIsoDate } from "@/lib/utils";
import type { BillOfLadingItemRow, UserRow } from "@/types/database";

type Draft = { good: number; damaged: number; remarks: string; acceptExcess: boolean; recordShort: boolean };

export function ReceivingReportForm({
  billOfLadingId,
  lines,
  users,
}: {
  billOfLadingId: string;
  lines: BillOfLadingItemRow[];
  users: Pick<UserRow, "id" | "full_name" | "username">[];
}) {
  const router = useRouter();
  const openLines = lines
    .map((line) => ({ line, expected: remainingToReceive(Number(line.shipped_qty), Number(line.received_qty)) }))
    .filter((row) => row.expected > 0);
  const [date, setDate] = useState(todayIsoDate());
  const [dr, setDr] = useState("");
  const [invoice, setInvoice] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [checkedBy, setCheckedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [gross, setGross] = useState("");
  const [tare, setTare] = useState("");
  const [ticket, setTicket] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(openLines.map((row) => [row.line.id, { good: row.expected, damaged: 0, remarks: "", acceptExcess: false, recordShort: false }])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const preview = useMemo(() => {
    return Object.fromEntries(
      openLines.map((row) => {
        const draft = drafts[row.line.id] ?? { good: 0, damaged: 0, remarks: "", acceptExcess: false };
        try {
          return [row.line.id, { ...receivingFigures(row.expected, draft.good, draft.damaged), recordShort: draft.recordShort }] as const;
        } catch {
          return [row.line.id, { actual: 0, shortQty: 0, excessQty: 0, recordShort: false }] as const;
        }
      }),
    );
  }, [drafts, openLines]);

  function patch(id: string, next: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...next } }));
  }

  async function onSubmit() {
    setPending(true);
    setError(null);
    for (const row of openLines) {
      const figures = preview[row.line.id];
      const draft = drafts[row.line.id];
      if (!figures || !draft) continue;
      if (((figures.shortQty > 0 && draft.recordShort) || draft.damaged > 0 || figures.excessQty > 0) && !draft.remarks.trim()) {
        setError("Remarks are required for a short, damaged, or excess receipt");
        setPending(false);
        return;
      }
      if (figures.excessQty > 0 && !draft.acceptExcess) {
        setError("Receiving quantity exceeds remaining BOL quantity.");
        setPending(false);
        return;
      }
    }
    const payload = {
      bill_of_lading_id: billOfLadingId,
      receiving_date: date,
      delivery_receipt_number: dr,
      supplier_invoice_number: invoice,
      received_by: receivedBy,
      checked_by: checkedBy,
      remarks,
      gross_weight: gross,
      tare_weight: tare,
      weighbridge_ticket: ticket,
      lines: openLines.map((row) => ({
        bol_item_id: row.line.id,
        good_qty: drafts[row.line.id]?.good ?? 0,
        damaged_qty: drafts[row.line.id]?.damaged ?? 0,
        accept_excess: drafts[row.line.id]?.acceptExcess ?? false,
        record_short: drafts[row.line.id]?.recordShort ?? false,
        remarks: drafts[row.line.id]?.remarks ?? "",
      })),
    };
    const parsed = receivingReportSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid receiving report");
      setPending(false);
      return;
    }
    const formData = new FormData();
    formData.set("payload", JSON.stringify(parsed.data));
    const result = await saveReceivingReport(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/receiving-reports/${result.id}`);
    router.refresh();
  }

  if (openLines.length === 0) {
    return <Card className="p-5 text-sm text-eq-slate">This bill of lading has no remaining quantity to receive.</Card>;
  }

  const net = gross && tare ? Number(gross) - Number(tare) : null;

  return (
    <Card className="p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Receiving date">
          <input className={inputClassName} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </FormField>
        <FormField label="Delivery receipt number">
          <input className={inputClassName} value={dr} onChange={(event) => setDr(event.target.value)} />
        </FormField>
        <FormField label="Supplier invoice number">
          <input className={inputClassName} value={invoice} onChange={(event) => setInvoice(event.target.value)} />
        </FormField>
        <FormField label="Received by">
          <select className={inputClassName} value={receivedBy} onChange={(event) => setReceivedBy(event.target.value)}>
            <option value="">—</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.full_name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Checked by">
          <select className={inputClassName} value={checkedBy} onChange={(event) => setCheckedBy(event.target.value)}>
            <option value="">—</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.full_name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Weighbridge ticket">
          <input className={inputClassName} value={ticket} onChange={(event) => setTicket(event.target.value)} />
        </FormField>
        <FormField label="Gross weight">
          <input className={inputClassName} value={gross} onChange={(event) => setGross(event.target.value)} placeholder="Optional" />
        </FormField>
        <FormField label="Tare weight">
          <input className={inputClassName} value={tare} onChange={(event) => setTare(event.target.value)} placeholder="Optional" />
        </FormField>
        <div className="md:col-span-2">
          <FormField label="Remarks">
            <textarea className={inputClassName} rows={2} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
          </FormField>
          {net !== null && !Number.isNaN(net) ? <p className="mt-1 text-xs text-eq-slate">Net weight preview {formatQty(net)}. The server stores net as gross − tare.</p> : null}
        </div>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-eq-slate">
            <tr>
              <th className="py-2 pr-3">Item</th>
              <th className="py-2 pr-3">Shipped</th>
              <th className="py-2 pr-3">Previously received</th>
              <th className="py-2 pr-3">Expected</th>
              <th className="py-2 pr-3">Good</th>
              <th className="py-2 pr-3">Damaged</th>
              <th className="py-2 pr-3">Short / Excess</th>
              <th className="py-2">Line remarks</th>
            </tr>
          </thead>
          <tbody>
            {openLines.map(({ line, expected }) => {
              const draft = drafts[line.id];
              const figures = preview[line.id];
              return (
                <tr key={line.id} className="border-t border-eq-line align-top">
                  <td className="py-2 pr-3">
                    <p>{line.item_name}</p>
                    <p className="text-xs text-eq-slate">{line.uom}</p>
                  </td>
                  <td className="py-2 pr-3">{formatQty(line.shipped_qty)}</td>
                  <td className="py-2 pr-3">{formatQty(line.received_qty)}</td>
                  <td className="py-2 pr-3">{formatQty(expected)}</td>
                  <td className="py-2 pr-3">
                    <input className={inputClassName} type="number" min="0" step="0.01" value={draft?.good ?? 0} onChange={(event) => patch(line.id, { good: Number(event.target.value) })} />
                  </td>
                  <td className="py-2 pr-3">
                    <input className={inputClassName} type="number" min="0" step="0.01" value={draft?.damaged ?? 0} onChange={(event) => patch(line.id, { damaged: Number(event.target.value) })} />
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    <p>Unreceived {formatQty(figures?.shortQty ?? 0)}</p>
                    <p>EXCESS {formatQty(figures?.excessQty ?? 0)}</p>
                    {(figures?.shortQty ?? 0) > 0 ? (
                      <label className="mt-1 flex items-center gap-1">
                        <input type="checkbox" checked={draft?.recordShort ?? false} onChange={(event) => patch(line.id, { recordShort: event.target.checked })} />
                        Record shortage
                      </label>
                    ) : null}
                    {(figures?.excessQty ?? 0) > 0 ? (
                      <label className="mt-1 flex items-center gap-1">
                        <input type="checkbox" checked={draft?.acceptExcess ?? false} onChange={(event) => patch(line.id, { acceptExcess: event.target.checked })} />
                        Accept excess
                      </label>
                    ) : null}
                  </td>
                  <td className="py-2">
                    <input className={inputClassName} value={draft?.remarks ?? ""} onChange={(event) => patch(line.id, { remarks: event.target.value })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" disabled={pending} className="mt-4 rounded-md bg-eq-navy px-3.5 py-2 text-sm text-white disabled:opacity-60" onClick={onSubmit}>
        {pending ? "Saving..." : "Save draft receiving report"}
      </button>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </Card>
  );
}
