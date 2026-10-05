import { PageHeader } from "@/components/page-header";
import { SupplierForm } from "@/components/forms/supplier-form";

export default function NewSupplierPage() {
  return (
    <div>
      <PageHeader title="New supplier" description="Supplier code is assigned when the record is saved." />
      <SupplierForm />
    </div>
  );
}
