"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { saveInventoryAdjustment } from "@/lib/inventory/actions";
import { inventoryAdjustmentSchema } from "@/lib/validation/schemas";
import { formatQty } from "@/lib/utils";
import type { InventoryAdjustmentItemRow, InventoryAdjustmentRow, InventoryStockRow, ItemRow } from "@/types/database";

type LineDraft = { item_id: string; quantity: number; direction: "increase" | "decrease" };

const emptyLine = (): LineDraft => ({ item_id: "", quantity: 1, direction: "increase" });

export function InventoryAdjustmentForm({
  items,
  stock,
  adjustment,
}: {
  items: ItemRow[];
  stock: InventoryStockRow[];
  adjustment?: InventoryAdjustmentRow & { inventory_adjustment_items: InventoryAdjustmentItemRow[] };
}) {
  const router = useRouter();
  const editing = Boolean(adjustment);
  const [lines, setLines] = useState<LineDraft[]>(
    adjustment?.inventory_adjustment_items?.length
      ? adjustment.inventory_adjustment_items.map((line) => ({
          item_id: line.item_id,
          quantity: Number(line.quantity),
          direction: line.direction,
        }))
      : [emptyLine()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function patchLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function stockFor(itemId: string) {
    return stock.find((row) => row.item_id === itemId);
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const payload = {
      id: adjustment?.id,
      remarks: String(formData.get("remarks") || ""),
      lines: lines.filter((line) => line.item_id),
    };
    const parsed = inventoryAdjustmentSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid adjustment");
      setPending(false);
      return;
    }
    const body = new FormData();
    body.set("payload", JSON.stringify(editing ? { ...parsed.data, id: adjustment?.id } : parsed.data));
    const result = await saveInventoryAdjustment(body);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/inventory/adjustments/${result.id}`);
    router.refresh();
  }

  return (
    <Card className="p-5">
      <form action={onSubmit} className="space-y-5">
        <p className="text-sm text-eq-slate">
          Increase for receipts and opening stock. Decrease for count shortages or write-offs. Posting writes the
          movement ledger. Available cannot go negative.
        </p>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-eq-ink">Lines</h2>
            <button type="button" className="text-sm text-eq-navy underline" onClick={() => setLines((current) => [...current, emptyLine()])}>
              Add line
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-eq-slate">
                <tr>
                  <th className="pb-2 pr-2">Item</th>
                  <th className="pb-2 pr-2">Direction</th>
                  <th className="pb-2 pr-2">Qty</th>
                  <th className="pb-2 pr-2">Available</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const itemStock = stockFor(line.item_id);
                  return (
                    <tr key={index} className="align-top">
                      <td className="py-1 pr-2 min-w-[14rem]">
                        <select className={inputClassName} value={line.item_id} onChange={(e) => patchLine(index, { item_id: e.target.value })}>
                          <option value="">Select item…</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pr-2 w-40">
                        <select
                          className={inputClassName}
                          value={line.direction}
                          onChange={(e) => patchLine(index, { direction: e.target.value as LineDraft["direction"] })}
                        >
                          <option value="increase">Increase</option>
                          <option value="decrease">Decrease</option>
                        </select>
                      </td>
                      <td className="py-1 pr-2 w-28">
                        <input
                          className={inputClassName}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) => patchLine(index, { quantity: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap text-eq-slate">
                        {itemStock ? formatQty(itemStock.available) : "—"}
                      </td>
                      <td className="py-2">
                        {lines.length > 1 ? (
                          <button
                            type="button"
                            className="text-xs text-rose-700 underline"
                            onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <FormField label="Remarks">
          <textarea className={inputClassName} name="remarks" rows={2} defaultValue={adjustment?.remarks ?? ""} />
        </FormField>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-eq-line pt-4">
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <button type="submit" disabled={pending} className="rounded-md bg-eq-navy px-4 py-2 text-sm text-white disabled:opacity-60">
            {pending ? "Saving…" : editing ? "Save changes" : "Save draft"}
          </button>
        </div>
      </form>
    </Card>
  );
}
