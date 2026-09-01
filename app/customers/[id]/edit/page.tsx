import { notFound } from "next/navigation";
import { PageHeader, SecondaryLink } from "@/components/page-header";
import { CustomerForm } from "@/components/forms/customer-form";
import { getCustomer } from "@/lib/data/queries";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <>
      <PageHeader
        title={`Edit ${customer.name}`}
        description="Changes apply to new documents only. Existing orders keep the snapshotted customer details."
        actions={<SecondaryLink href={`/customers/${customer.id}`}>Cancel</SecondaryLink>}
      />
      <CustomerForm customer={customer} />
    </>
  );
}
