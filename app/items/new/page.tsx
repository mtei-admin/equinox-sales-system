import { PageHeader } from "@/components/page-header";
import { ItemForm } from "@/components/forms/item-form";

export default function NewItemPage() {
  return (
    <>
      <PageHeader title="New item" description="Catalog item. Serial and barcode can be overridden on the sales order line." />
      <ItemForm />
    </>
  );
}
