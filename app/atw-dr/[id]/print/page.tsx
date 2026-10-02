import { notFound } from "next/navigation";
import { PrintDocumentView } from "@/components/print/print-document";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { getAtw } from "@/lib/data/queries";
import { atwPrintDocument } from "@/lib/print/documents";

export default async function AtwPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getAtw(id);
  if (!doc) notFound();

  return (
    <div className="print-page">
      <PrintToolbar backHref={`/atw-dr/${doc.id}`} />
      <PrintDocumentView document={atwPrintDocument(doc)} />
    </div>
  );
}
