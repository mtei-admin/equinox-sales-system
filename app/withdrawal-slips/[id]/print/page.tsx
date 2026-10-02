import { notFound } from "next/navigation";
import { PrintDocumentView } from "@/components/print/print-document";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { getWithdrawalSlip } from "@/lib/data/queries";
import { withdrawalSlipPrintDocument } from "@/lib/print/documents";

export default async function WithdrawalSlipPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slip = await getWithdrawalSlip(id);
  if (!slip) notFound();

  return (
    <div className="print-page">
      <PrintToolbar backHref={`/withdrawal-slips/${slip.id}`} />
      <PrintDocumentView document={withdrawalSlipPrintDocument(slip)} />
    </div>
  );
}
