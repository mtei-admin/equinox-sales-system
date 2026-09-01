import { notFound } from "next/navigation";
import { Card, PageHeader, PrimaryLink, SecondaryLink } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { AuditFields } from "@/components/audit-fields";
import { Can } from "@/components/can";
import { getCustomer } from "@/lib/data/queries";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const fields = [
    ["TIN", customer.tin_number ?? "—"],
    ["Contact", customer.contact_person ?? "—"],
    ["Phone", customer.contact_number ?? "—"],
    ["Billing address", customer.billing_address ?? "—"],
  ];

  return (
    <>
      <PageHeader
        title={customer.name}
        description="Master data. Historical documents keep the name snapshotted at order time."
        actions={
          <>
            <Can permission="customers.write">
              <PrimaryLink href={`/customers/${customer.id}/edit`}>Edit</PrimaryLink>
            </Can>
            <SecondaryLink href="/customers">Back to list</SecondaryLink>
          </>
        }
      />
      <Card className="p-5">
        <StatusBadge status={customer.status} />
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wide text-eq-slate">{label}</dt>
              <dd className="mt-1 text-sm text-eq-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <AuditFields
          createdAt={customer.created_at}
          createdByName={customer.created_by_name}
          updatedAt={customer.updated_at}
          updatedByName={customer.updated_by_name}
        />
      </Card>
    </>
  );
}
