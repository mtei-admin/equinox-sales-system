import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SupplierForm } from "@/components/forms/supplier-form";
import { getSupplier } from "@/lib/purchasing/queries";

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${supplier.supplier_code}`} description="Inactivate a supplier instead of deleting it." />
      <SupplierForm supplier={supplier} />
    </div>
  );
}
