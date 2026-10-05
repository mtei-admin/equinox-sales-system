import { PageHeader } from "@/components/page-header";
import { PurchaseOrderForm } from "@/components/forms/purchase-order-form";
import { listItems } from "@/lib/data/queries";
import { listSuppliers } from "@/lib/purchasing/queries";

export default async function NewPurchaseOrderPage() {
  const [suppliers, items] = await Promise.all([
    listSuppliers("", "active"),
    listItems({ q: "", status: "active" }),
  ]);
  return (
    <>
      <PageHeader title="New purchase order" description="The PO number is assigned when the draft is saved." />
      <PurchaseOrderForm suppliers={suppliers} items={items} />
    </>
  );
}
