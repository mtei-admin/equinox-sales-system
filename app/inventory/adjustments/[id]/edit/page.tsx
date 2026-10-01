import { notFound, redirect } from "next/navigation";
import { PageHeader, SecondaryLink } from "@/components/page-header";
import { InventoryAdjustmentForm } from "@/components/forms/inventory-adjustment-form";
import { getInventoryAdjustment, listInventoryStock, listItems } from "@/lib/data/queries";
import { requirePermission } from "@/lib/auth/guards";

export default async function EditInventoryAdjustmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("inventory.write");
  const { id } = await params;
  const doc = await getInventoryAdjustment(id);
  if (!doc) notFound();
  if (doc.status !== "draft") redirect(`/inventory/adjustments/${doc.id}`);

  const [items, stock] = await Promise.all([
    listItems({ q: "", status: "active" }),
    listInventoryStock(),
  ]);

  return (
    <>
      <PageHeader
        title={`Edit ${doc.adj_number}`}
        description="Draft only. Posting locks the lines and writes movements."
        actions={<SecondaryLink href={`/inventory/adjustments/${doc.id}`}>Cancel</SecondaryLink>}
      />
      <InventoryAdjustmentForm items={items} stock={stock} adjustment={doc} />
    </>
  );
}
