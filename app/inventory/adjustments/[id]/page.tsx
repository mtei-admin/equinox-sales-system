import { notFound } from "next/navigation";
import { Card, PageHeader, PrimaryLink, SecondaryLink } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { AuditFields } from "@/components/audit-fields";
import { Can } from "@/components/can";
import { CancelAdjustmentButton, PostAdjustmentButton } from "@/components/forms/inventory-adjustment-status-actions";
import { getInventoryAdjustment } from "@/lib/data/queries";
import { formatQty } from "@/lib/utils";

export default async function InventoryAdjustmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getInventoryAdjustment(id);
  if (!doc) notFound();
  const canPost = doc.status === "draft";
  const canEdit = doc.status === "draft";
  const canCancel = doc.status !== "cancelled";

  return (
    <>
      <PageHeader
        title={doc.adj_number}
        description={doc.reason || doc.remarks || "Inventory adjustment"}
        actions={
          <>
            {canEdit ? (
              <Can permission="inventory.write">
                <PrimaryLink href={`/inventory/adjustments/${doc.id}/edit`}>Edit</PrimaryLink>
              </Can>
            ) : null}
            {canPost ? (
              <Can permission="inventory.write">
                <PostAdjustmentButton id={doc.id} />
              </Can>
            ) : null}
            {canCancel ? (
              <Can permission="inventory.write">
                <CancelAdjustmentButton id={doc.id} />
              </Can>
            ) : null}
            <SecondaryLink href="/inventory/adjustments">Back</SecondaryLink>
          </>
        }
      />
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-eq-slate">
          <StatusBadge status={doc.status} />
        </div>
        {doc.remarks ? <p className="mb-4 text-sm text-eq-slate">{doc.remarks}</p> : null}
        <h2 className="text-sm font-semibold text-eq-ink">Lines</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-eq-slate">
              <tr>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Direction</th>
                <th className="py-2">Qty</th>
              </tr>
            </thead>
            <tbody>
              {doc.inventory_adjustment_items.map((line) => (
                <tr key={line.id} className="border-t border-eq-line">
                  <td className="py-2 pr-3">
                    <p>{line.item_name}</p>
                    <p className="text-xs text-eq-slate">{[line.model, line.barcode].filter(Boolean).join(" · ") || "—"}</p>
                  </td>
                  <td className="py-2 pr-3 capitalize">{line.direction}</td>
                  <td className="py-2">{formatQty(line.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AuditFields
          createdAt={doc.created_at}
          createdByName={doc.created_by_name}
          updatedAt={doc.updated_at}
          updatedByName={doc.updated_by_name}
          cancelledAt={doc.cancelled_at}
          cancelledByName={doc.cancelled_by_name}
          cancellationReason={doc.cancellation_reason}
        />
      </Card>
    </>
  );
}
