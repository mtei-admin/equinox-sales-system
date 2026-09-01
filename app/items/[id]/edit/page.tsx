import { notFound } from "next/navigation";
import { PageHeader, SecondaryLink } from "@/components/page-header";
import { ItemForm } from "@/components/forms/item-form";
import { getItem } from "@/lib/data/queries";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();

  return (
    <>
      <PageHeader
        title={`Edit ${item.name}`}
        description="Changes apply to new sales order lines. Existing documents keep their line snapshots."
        actions={<SecondaryLink href={`/items/${item.id}`}>Cancel</SecondaryLink>}
      />
      <ItemForm item={item} />
    </>
  );
}
