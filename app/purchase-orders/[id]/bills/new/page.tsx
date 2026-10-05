import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { BillOfLadingForm } from "@/components/forms/bill-of-lading-form";
import { getPurchaseOrder } from "@/lib/purchasing/queries";

const BLOCKED = new Set(["draft", "for_approval", "cancelled", "closed", "completed"]);

export default async function NewBillOfLadingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getPurchaseOrder(id);
  if (!order || BLOCKED.has(order.status)) notFound();
  return (
    <>
      <PageHeader
        title={`Bill of lading for ${order.po_number}`}
        description={`${order.supplier_name}. Shipment does not change stock. Current shipped quantity cannot exceed remaining to ship.`}
      />
      <BillOfLadingForm purchaseOrderId={order.id} destination={order.destination} lines={order.purchase_order_items} />
    </>
  );
}
