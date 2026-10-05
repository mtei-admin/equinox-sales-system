import { notFound } from "next/navigation";
import { Card, PageHeader, PrimaryLink, SecondaryLink } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { AuditFields } from "@/components/audit-fields";
import { Can } from "@/components/can";
import { getItem, getItemStock } from "@/lib/data/queries";
import { formatQty } from "@/lib/utils";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();
  const stock = await getItemStock(id);

  return (
    <>
      <PageHeader
        title={item.name}
        description={item.description ?? "Catalog item"}
        actions={
          <>
            <Can permission="items.write">
              <PrimaryLink href={`/items/${item.id}/edit`}>Edit</PrimaryLink>
            </Can>
            <SecondaryLink href="/items">Back to list</SecondaryLink>
          </>
        }
      />
      <Card className="p-5">
        <StatusBadge status={item.status} />
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-eq-slate">Brand</dt>
            <dd className="mt-1 text-sm">{item.brand ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-eq-slate">Model</dt>
            <dd className="mt-1 text-sm">{item.model ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-eq-slate">Serial</dt>
            <dd className="mt-1 font-mono text-sm">{item.serial_no ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-eq-slate">Barcode</dt>
            <dd className="mt-1 font-mono text-sm">{item.barcode ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-eq-slate">On hand</dt>
            <dd className="mt-1 text-sm">{stock ? formatQty(stock.on_hand) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-eq-slate">Commited</dt>
            <dd className="mt-1 text-sm">{stock ? formatQty(stock.reserved) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-eq-slate">Available</dt>
            <dd className="mt-1 text-sm">{stock ? formatQty(stock.available) : "—"}</dd>
          </div>
        </dl>
        <AuditFields
          createdAt={item.created_at}
          createdByName={item.created_by_name}
          updatedAt={item.updated_at}
          updatedByName={item.updated_by_name}
        />
      </Card>
    </>
  );
}
