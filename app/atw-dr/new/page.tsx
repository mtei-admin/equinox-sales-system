import { Card, PageHeader } from "@/components/page-header";
import { AtwForm } from "@/components/forms/atw-form";
import { listInvoices } from "@/lib/data/queries";
import { loadAtwSource } from "@/lib/atw/actions";
import { requirePermission } from "@/lib/auth/guards";

export default async function NewAtwPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("atw-dr.write");
  const params = await searchParams;
  const requested = Array.isArray(params.invoice_id) ? params.invoice_id[0] : params.invoice_id;
  const invoices = await listInvoices({ q: "", status: "posted" });
  const selectedId = requested && invoices.some((invoice) => invoice.id === requested) ? requested : invoices[0]?.id;
  const source = selectedId ? await loadAtwSource(selectedId) : null;

  return (
    <>
      <PageHeader
        title="New ATW / DR"
        description="Load a posted invoice, review remaining quantity, then copy eligible lines. Partial and multiple ATW/DR documents are allowed."
      />
      {invoices.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-eq-slate">There are no posted invoices to allocate. Post an invoice first.</p>
        </Card>
      ) : (
        <AtwForm
          invoices={invoices}
          initialSource={source && source.ok ? source : null}
          initialError={source && !source.ok ? source.error : null}
        />
      )}
    </>
  );
}
