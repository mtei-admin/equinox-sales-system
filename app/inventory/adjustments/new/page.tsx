import { PageHeader, SecondaryLink } from "@/components/page-header";
import { InventoryAdjustmentForm } from "@/components/forms/inventory-adjustment-form";
import { listCompanyStock, listItems, listWarehouses } from "@/lib/data/queries";
import { requirePermission } from "@/lib/auth/guards";

export default async function NewInventoryAdjustmentPage() {
  await requirePermission("inventory.write");
  const [items, stock, warehouses] = await Promise.all([
    listItems({ q: "", status: "active" }),
    listCompanyStock(),
    listWarehouses(),
  ]);

  return (
    <>
      <PageHeader
        title="New inventory adjustment"
        description="Save as draft, then post to update on-hand. Available is shown per item."
        actions={<SecondaryLink href="/inventory/adjustments">Back</SecondaryLink>}
      />
      <InventoryAdjustmentForm items={items} stock={stock} warehouses={warehouses} />
    </>
  );
}
