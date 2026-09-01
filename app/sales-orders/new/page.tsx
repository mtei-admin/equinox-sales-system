import { PageHeader } from "@/components/page-header";
import { SalesOrderForm } from "@/components/forms/sales-order-form";
import { listActiveUsers, listCustomers, listItems } from "@/lib/data/queries";
import { requirePermission } from "@/lib/auth/guards";

export default async function NewSalesOrderPage() {
  const profile = await requirePermission("sales-orders.write");
  const [customers, items, employees] = await Promise.all([
    listCustomers({ q: "", status: "active" }),
    listItems({ q: "", status: "active" }),
    listActiveUsers(),
  ]);

  return (
    <>
      <PageHeader
        title="New sales order"
        description="Customer, items, quantity, and unit price. Totals are computed as quantity × unit price."
      />
      <SalesOrderForm customers={customers} items={items} employees={employees} currentUserId={profile.id} />
    </>
  );
}
