import { notFound, redirect } from "next/navigation";
import { PageHeader, SecondaryLink } from "@/components/page-header";
import { SalesOrderForm } from "@/components/forms/sales-order-form";
import { getSalesOrder, listActiveUsers, listCustomers, listInventoryStock, listItems } from "@/lib/data/queries";
import { requirePermission } from "@/lib/auth/guards";

export default async function EditSalesOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission("sales-orders.write");
  const { id } = await params;
  const order = await getSalesOrder(id);
  if (!order) notFound();
  if (order.status !== "draft") redirect(`/sales-orders/${order.id}`);

  const [customers, items, employees, stock] = await Promise.all([
    listCustomers({ q: "", status: "active" }),
    listItems({ q: "", status: "active" }),
    listActiveUsers(),
    listInventoryStock(),
  ]);
  const customerOptions = customers.some((row) => row.id === order.customer_id)
    ? customers
    : [
        {
          id: order.customer_id,
          name: order.customer_name,
          billing_address: order.delivery_address,
          tin_number: null,
          status: "inactive" as const,
          contact_person: null,
          contact_number: null,
          created_by: null,
          created_at: order.created_at,
          updated_by: null,
          updated_at: order.updated_at,
        },
        ...customers,
      ];
  const usedItemIds = new Set(order.sales_order_items.map((line) => line.item_id));
  const itemOptions = [
    ...items,
    ...order.sales_order_items
      .filter((line) => !items.some((item) => item.id === line.item_id))
      .map((line) => ({
        id: line.item_id,
        name: line.description || line.model || "Item",
        description: line.description,
        brand: null,
        model: line.model,
        serial_no: line.serial_no,
        barcode: line.barcode,
        status: "inactive" as const,
        created_by: null,
        created_at: order.created_at,
        updated_by: null,
        updated_at: order.updated_at,
      }))
      .filter((item, index, rows) => usedItemIds.has(item.id) && rows.findIndex((row) => row.id === item.id) === index),
  ];

  return (
    <>
      <PageHeader
        title={`Edit ${order.so_number}`}
        description="Draft only. Opening the order locks lines so invoice remaining quantity stays valid."
        actions={<SecondaryLink href={`/sales-orders/${order.id}`}>Cancel</SecondaryLink>}
      />
      <SalesOrderForm
        customers={customerOptions}
        items={itemOptions}
        stock={stock}
        employees={employees}
        currentUserId={profile.id}
        order={order}
      />
    </>
  );
}
