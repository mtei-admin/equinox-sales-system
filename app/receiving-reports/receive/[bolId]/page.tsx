import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ReceivingReportForm } from "@/components/forms/receiving-report-form";
import { listActiveUsers, listWarehouses } from "@/lib/data/queries";
import { getBillOfLading } from "@/lib/purchasing/queries";
import { requirePermission } from "@/lib/auth/guards";

const ALLOWED = new Set(["posted", "in_transit", "arrived", "partially_received"]);

export default async function ReceiveBillPage({ params }: { params: Promise<{ bolId: string }> }) {
  await requirePermission("receiving-reports.write");
  const { bolId } = await params;
  const [bill, users, warehouses] = await Promise.all([getBillOfLading(bolId), listActiveUsers(), listWarehouses()]);
  if (!bill || !ALLOWED.has(bill.status)) notFound();
  const po = bill.purchase_orders;
  return (
    <>
      <PageHeader
        title={`Receiving report for ${bill.bol_number}`}
        description={[po?.supplier_name, po?.po_number, bill.bol_number].filter(Boolean).join(" · ")}
      />
      <ReceivingReportForm billOfLadingId={bill.id} lines={bill.bill_of_lading_items} users={users} warehouses={warehouses} />
    </>
  );
}
