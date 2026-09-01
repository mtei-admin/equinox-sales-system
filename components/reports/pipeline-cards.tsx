import { Card } from "@/components/page-header";
import { formatQty } from "@/lib/utils";
import type { PipelineTotals } from "@/lib/reports/pipeline";

export function PipelineCards({ totals }: { totals: PipelineTotals }) {
  const cards = [
    {
      label: "Remaining sales orders",
      count: totals.remaining_so_count,
      detail: `Qty remaining ${formatQty(totals.remaining_so_qty)}`,
    },
    {
      label: "Remaining posted invoices",
      count: totals.remaining_invoice_count,
      detail: `Qty remaining ${formatQty(totals.remaining_invoice_qty)}`,
    },
    {
      label: "ATW/DR awaiting slip",
      count: totals.awaiting_withdrawal_count,
      detail: "Released documents with no non-cancelled withdrawal slip",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label} className="p-4">
          <p className="text-xs uppercase tracking-wide text-eq-slate">{card.label}</p>
          <p className="mt-2 text-3xl font-semibold text-eq-ink">{card.count}</p>
          <p className="mt-1 text-sm text-eq-slate">{card.detail}</p>
        </Card>
      ))}
    </div>
  );
}
