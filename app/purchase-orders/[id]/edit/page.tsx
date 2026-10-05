import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PurchaseOrderForm } from "@/components/forms/purchase-order-form";
import { listItems } from "@/lib/data/queries";
import { getPurchaseOrder, listSuppliers } from "@/lib/purchasing/queries";

export default async function EditPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, suppliers, items] = await Promise.all([
    getPurchaseOrder(id),
    listSuppliers("", "active"),
    listItems({ q: "", status: "active" }),
  ]);
  if (!order || order.status !== "draft") notFound();
  return (
    <>
      <PageHeader title={`Edit ${order.po_number}`} description="Only a draft purchase order can be edited." />
      <PurchaseOrderForm suppliers={suppliers} items={items} order={order} />
    </>
  );
}
