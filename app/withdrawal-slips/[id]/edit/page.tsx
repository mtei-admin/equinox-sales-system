import { notFound, redirect } from "next/navigation";
import { PageHeader, SecondaryLink } from "@/components/page-header";
import { WithdrawalSlipForm } from "@/components/forms/withdrawal-slip-form";
import { getAtw, getWithdrawalSlip } from "@/lib/data/queries";
import { requirePermission } from "@/lib/auth/guards";

export default async function EditWithdrawalSlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("withdrawal-slips.write");
  const { id } = await params;
  const slip = await getWithdrawalSlip(id);
  if (!slip) notFound();
  if (slip.status !== "draft") redirect(`/withdrawal-slips/${slip.id}`);
  const atw = await getAtw(slip.atw_id);
  const priceByItem = new Map((atw?.atw_document_items ?? []).map((line) => [line.id, line.unit_price]));

  return (
    <>
      <PageHeader
        title={`Edit ${slip.ws_number}`}
        description="Draft only. Line quantities stay equal to the ATW/DR. Remarks can be updated."
        actions={<SecondaryLink href={`/withdrawal-slips/${slip.id}`}>Cancel</SecondaryLink>}
      />
      <WithdrawalSlipForm
        slipId={slip.id}
        atwId={slip.atw_id}
        atwNumber={slip.atw_number}
        documentType={slip.document_type}
        customerName={slip.customer_name}
        remarks={slip.remarks ?? ""}
        lines={slip.withdrawal_slip_items.map((line) => ({
          atw_item_id: line.atw_item_id,
          description: line.description,
          model: line.model,
          uom: line.uom,
          unit_price: priceByItem.get(line.atw_item_id) ?? (line.quantity ? line.amount / line.quantity : 0),
          quantity: line.quantity,
        }))}
      />
    </>
  );
}
