import { Card, PageHeader } from "@/components/page-header";
import { InvoiceForm } from "@/components/forms/invoice-form";
import { listSalesOrders } from "@/lib/data/queries";
import { loadInvoiceSource } from "@/lib/invoices/actions";
import { requirePermission } from "@/lib/auth/guards";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("invoices.write");
  const params = await searchParams;
  const requested = Array.isArray(params.sales_order_id) ? params.sales_order_id[0] : params.sales_order_id;
  const orders = await listSalesOrders({ q: "", status: "open" });
  const selectedId = requested && orders.some((order) => order.id === requested) ? requested : orders[0]?.id;
  const source = selectedId ? await loadInvoiceSource(selectedId) : null;

  return (
    <>
      <PageHeader
        title="New invoice"
        description="Load an open sales order, review remaining quantity, then copy eligible lines. Partial and multiple invoices are allowed."
      />
      {orders.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-eq-slate">There are no open sales orders to invoice. Open a draft sales order first.</p>
        </Card>
      ) : (
        <InvoiceForm
          orders={orders}
          initialSource={source && source.ok ? source : null}
          initialError={source && !source.ok ? source.error : null}
        />
      )}
    </>
  );
}
