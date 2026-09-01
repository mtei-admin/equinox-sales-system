"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { headerTotals, soLineTotals } from "@/lib/business/totals";
import { saveWithdrawalSlip, type WsSourceLine } from "@/lib/withdrawal-slips/actions";
import { updateWithdrawalSlipSchema, withdrawalSlipSchema } from "@/lib/validation/schemas";
import { formatMoney, formatQty } from "@/lib/utils";

export function WithdrawalSlipForm({
  atwId,
  atwNumber,
  documentType,
  customerName,
  lines,
  slipId,
  remarks = "",
}: {
  atwId: string;
  atwNumber: string;
  documentType: string;
  customerName: string;
  lines: WsSourceLine[];
  slipId?: string;
  remarks?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const editing = Boolean(slipId);
  const typeLabel = documentType === "dr" ? "Delivery Receipt" : "ATW";
  const totals = useMemo(
    () =>
      headerTotals(
        lines.map((line) => ({
          quantity: line.quantity,
          total_amount: soLineTotals(line.quantity, line.unit_price).total_amount,
        })),
      ),
    [lines],
  );

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const payload = {
      id: slipId,
      atw_id: atwId,
      remarks: String(formData.get("remarks") || ""),
      lines: lines.map((line) => ({
        atw_item_id: line.atw_item_id,
        quantity: line.quantity,
      })),
    };
    const parsed = editing ? updateWithdrawalSlipSchema.safeParse(payload) : withdrawalSlipSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid withdrawal slip");
      setPending(false);
      return;
    }
    const body = new FormData();
    body.set("payload", JSON.stringify(parsed.data));
    const result = await saveWithdrawalSlip(body);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/withdrawal-slips/${result.id}`);
    router.refresh();
  }

  return (
    <Card className="p-5">
      <form action={onSubmit} className="space-y-5">
        <p className="text-sm text-eq-slate">
          {typeLabel} <span className="font-mono text-eq-ink">{atwNumber}</span> · {customerName}
        </p>
        <p className="text-xs text-eq-slate">
          Every ATW/DR line is copied at the same quantity. Quantities cannot be changed. One non-cancelled slip is
          allowed per ATW/DR.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-eq-slate">
              <tr>
                <th className="pb-2 pr-2">Item</th>
                <th className="pb-2 pr-2">Qty</th>
                <th className="pb-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.atw_item_id} className="border-t border-eq-line">
                  <td className="py-2 pr-2">
                    <p>{line.description ?? line.model ?? "Item"}</p>
                    <p className="text-xs text-eq-slate">
                      {formatMoney(line.unit_price)} / {line.uom}
                    </p>
                  </td>
                  <td className="py-2 pr-2">
                    {formatQty(line.quantity)} {line.uom}
                  </td>
                  <td className="py-2">{formatMoney(soLineTotals(line.quantity, line.unit_price).amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FormField label="Remarks">
          <textarea className={inputClassName} name="remarks" rows={2} defaultValue={remarks} />
        </FormField>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-eq-line pt-4">
          <div className="text-sm">
            <p>Slip qty {formatQty(totals.total_quantity)}</p>
            <p className="font-semibold text-eq-ink">Grand total {formatMoney(totals.grand_total)}</p>
          </div>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <button type="submit" disabled={pending || lines.length === 0} className="rounded-md bg-eq-navy px-4 py-2 text-sm text-white disabled:opacity-60">
            {pending ? "Saving…" : editing ? "Save" : "Save draft"}
          </button>
        </div>
      </form>
    </Card>
  );
}
