import { notFound } from "next/navigation";
import { PrintDocumentView } from "@/components/print/print-document";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { getInvoice } from "@/lib/data/queries";
import { invoicePrintDocument } from "@/lib/print/documents";

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  return (
    <div className="print-page">
      <PrintToolbar backHref={`/invoices/${invoice.id}`} />
      <PrintDocumentView document={invoicePrintDocument(invoice)} />
    </div>
  );
}
