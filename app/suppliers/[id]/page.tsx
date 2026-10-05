import { notFound } from "next/navigation";
import { Card, PageHeader, SecondaryLink } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { AuditFields } from "@/components/audit-fields";
import { getSupplier } from "@/lib/purchasing/queries";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();
  const fields: [string, string | null][] = [
    ["Code", supplier.supplier_code],
    ["Contact", supplier.contact_person],
    ["Phone", supplier.contact_number],
    ["Email", supplier.email],
    ["TIN", supplier.tin_number],
    ["Terms", supplier.payment_terms],
    ["Address", supplier.address],
    ["Remarks", supplier.remarks],
  ];

  return (
    <>
      <PageHeader
        title={supplier.name}
        description="Supplier master"
        actions={
          <>
            <Can permission="suppliers.write">
              <SecondaryLink href={`/suppliers/${supplier.id}/edit`}>Edit</SecondaryLink>
            </Can>
            <SecondaryLink href="/suppliers">Back</SecondaryLink>
          </>
        }
      />
      <Card className="p-5">
        <div className="mb-4">
          <StatusBadge status={supplier.status} />
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wide text-eq-slate">{label}</dt>
              <dd className="mt-1 text-sm">{value || "—"}</dd>
            </div>
          ))}
        </dl>
        <AuditFields
          createdAt={supplier.created_at}
          createdByName={null}
          updatedAt={supplier.updated_at}
          updatedByName={null}
        />
      </Card>
    </>
  );
}
