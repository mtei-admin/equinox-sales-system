import { PageHeader } from "@/components/page-header";
import { CustomerForm } from "@/components/forms/customer-form";

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader title="New customer" description="Name, billing address, and TIN. Delivery address can be edited on each sales order." />
      <CustomerForm />
    </>
  );
}
