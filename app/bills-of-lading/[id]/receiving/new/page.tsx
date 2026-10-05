import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ReceivingReportForm } from "@/components/forms/receiving-report-form";
import { listActiveUsers } from "@/lib/data/queries";
import { getBillOfLading } from "@/lib/purchasing/queries";

const ALLOWED = new Set(["posted", "in_transit", "arrived", "partially_received"]);

export default async function NewReceivingReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bill, users] = await Promise.all([getBillOfLading(id), listActiveUsers()]);
  if (!bill || !ALLOWED.has(bill.status)) notFound();
  const po = bill.purchase_orders;
  return (
    <>
      <PageHeader
        title={`Receiving report for ${bill.bol_number}`}
        description={[po?.supplier_name, po?.po_number, bill.bol_number].filter(Boolean).join(" · ")}
      />
      <ReceivingReportForm billOfLadingId={bill.id} lines={bill.bill_of_lading_items} users={users} />
    </>
  );
}
