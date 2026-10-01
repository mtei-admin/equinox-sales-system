"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { headerTotals, soLineTotals } from "@/lib/business/totals";
import { saveSalesOrder } from "@/lib/sales-orders/actions";
import { salesOrderSchema } from "@/lib/validation/schemas";
import { formatMoney, formatQty, todayIsoDate } from "@/lib/utils";
import type { CustomerRow, InventoryStockRow, ItemRow, SalesOrderItemRow, SalesOrderRow, UserRow } from "@/types/database";

type LineDraft = {
  item_id: string;
  quantity: number;
  unit_price: number;
  uom: string;
  model: string;
  serial_no: string;
  barcode: string;
  description: string;
};

const emptyLine = (): LineDraft => ({
  item_id: "",
  quantity: 1,
  unit_price: 0,
  uom: "PCS",
  model: "",
  serial_no: "",
  barcode: "",
  description: "",
});

function lineFromItem(item: ItemRow): LineDraft {
  return {
    item_id: item.id,
    quantity: 1,
    unit_price: 0,
    uom: "PCS",
    model: item.model ?? "",
    serial_no: item.serial_no ?? "",
    barcode: item.barcode ?? "",
    description: item.description || item.name,
  };
}

function lineFromSaved(line: SalesOrderItemRow): LineDraft {
  return {
    item_id: line.item_id,
    quantity: Number(line.quantity),
    unit_price: Number(line.unit_price),
    uom: line.uom || "PCS",
    model: line.model ?? "",
    serial_no: line.serial_no ?? "",
    barcode: line.barcode ?? "",
    description: line.description ?? "",
  };
}

export function SalesOrderForm({
  customers,
  items,
  stock = [],
  employees,
  currentUserId,
  order,
}: {
  customers: CustomerRow[];
  items: ItemRow[];
  stock?: InventoryStockRow[];
  employees: Pick<UserRow, "id" | "full_name" | "username">[];
  currentUserId: string;
  order?: SalesOrderRow & { sales_order_items: SalesOrderItemRow[] };
}) {
  const router = useRouter();
  const editing = Boolean(order);
  const [customerId, setCustomerId] = useState(order?.customer_id ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(order?.delivery_address ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    order?.sales_order_items?.length ? order.sales_order_items.map(lineFromSaved) : [emptyLine()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const totals = useMemo(
    () =>
      headerTotals(
        lines
          .filter((line) => line.item_id && line.quantity > 0 && line.unit_price >= 0)
          .map((line) => ({ quantity: line.quantity, ...soLineTotals(line.quantity, line.unit_price) })),
      ),
    [lines],
  );

  function selectCustomer(id: string) {
    setCustomerId(id);
    const customer = customers.find((row) => row.id === id);
    setDeliveryAddress(customer?.billing_address ?? "");
  }

  function patchLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function selectItem(index: number, itemId: string) {
    const item = items.find((row) => row.id === itemId);
    if (!item) {
      patchLine(index, emptyLine());
      return;
    }
    setLines((current) => current.map((row, i) => (i === index ? { ...lineFromItem(item), quantity: row.quantity, unit_price: row.unit_price, uom: row.uom || "PCS" } : row)));
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const payload = {
      id: order?.id,
      customer_id: customerId,
      delivery_address: deliveryAddress,
      order_date: String(formData.get("order_date") || ""),
      term: String(formData.get("term") || ""),
      reference_no: String(formData.get("reference_no") || ""),
      order_type: String(formData.get("order_type") || ""),
      sales_employee_id: String(formData.get("sales_employee_id") || ""),
      remarks: String(formData.get("remarks") || ""),
      lines: lines.filter((line) => line.item_id),
    };
    const parsed = salesOrderSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid sales order");
      setPending(false);
      return;
    }
    const body = new FormData();
    body.set("payload", JSON.stringify(editing ? { ...parsed.data, id: order?.id } : parsed.data));
    const result = await saveSalesOrder(body);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/sales-orders/${result.id}`);
    router.refresh();
  }

  return (
    <Card className="p-5">
      <form action={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Customer">
            <select className={inputClassName} name="customer_id" required value={customerId} onChange={(e) => selectCustomer(e.target.value)}>
              <option value="">Select…</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Order date">
            <input className={inputClassName} type="date" name="order_date" defaultValue={order?.order_date ?? todayIsoDate()} required />
          </FormField>
          <FormField label="Term">
            <input className={inputClassName} name="term" defaultValue={order?.term ?? ""} />
          </FormField>
          <FormField label="Order type">
            <input className={inputClassName} name="order_type" defaultValue={order?.order_type ?? ""} />
          </FormField>
          <FormField label="Reference no.">
            <input className={inputClassName} name="reference_no" defaultValue={order?.reference_no ?? ""} />
          </FormField>
          <FormField label="Sales employee">
            <select className={inputClassName} name="sales_employee_id" defaultValue={order?.sales_employee_id ?? currentUserId}>
              <option value="">Select…</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name || employee.username}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Delivery address" className="sm:col-span-2">
            <textarea className={inputClassName} name="delivery_address" rows={2} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
          </FormField>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-eq-ink">Lines</h2>
            <button type="button" className="text-sm text-eq-navy underline" onClick={() => setLines((current) => [...current, emptyLine()])}>
              Add line
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-eq-slate">
                <tr>
                  <th className="pb-2 pr-2">Item</th>
                  <th className="pb-2 pr-2">Available</th>
                  <th className="pb-2 pr-2">Qty</th>
                  <th className="pb-2 pr-2">UOM</th>
                  <th className="pb-2 pr-2">Unit price</th>
                  <th className="pb-2 pr-2">Amount</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const amount = line.item_id && line.quantity > 0 ? soLineTotals(line.quantity, line.unit_price).total_amount : 0;
                  const available = stock.find((row) => row.item_id === line.item_id)?.available;
                  return (
                    <tr key={index} className="align-top">
                      <td className="py-1 pr-2 min-w-[14rem]">
                        <select className={inputClassName} value={line.item_id} onChange={(e) => selectItem(index, e.target.value)}>
                          <option value="">Select item…</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap text-xs text-eq-slate">
                        {available == null ? "—" : formatQty(available)}
                      </td>
                      <td className="py-1 pr-2 w-28">
                        <input
                          className={inputClassName}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) => patchLine(index, { quantity: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-1 pr-2 w-24">
                        <input className={inputClassName} value={line.uom} onChange={(e) => patchLine(index, { uom: e.target.value })} />
                      </td>
                      <td className="py-1 pr-2 w-32">
                        <input
                          className={inputClassName}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={(e) => patchLine(index, { unit_price: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap">{formatMoney(amount)}</td>
                      <td className="py-2">
                        {lines.length > 1 ? (
                          <button type="button" className="text-xs text-rose-700 underline" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-eq-slate">
            Unit price and UOM are entered on the line. Amount = quantity × unit price. Opening the order reserves
            quantity and is rejected if available is not enough.
          </p>
        </div>

        <FormField label="Remarks">
          <textarea className={inputClassName} name="remarks" rows={2} defaultValue={order?.remarks ?? ""} />
        </FormField>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-eq-line pt-4">
          <div className="text-sm">
            <p>Total quantity {totals.total_quantity}</p>
            <p className="font-semibold text-eq-ink">Grand total {formatMoney(totals.grand_total)}</p>
          </div>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <button type="submit" disabled={pending} className="rounded-md bg-eq-navy px-4 py-2 text-sm text-white disabled:opacity-60">
            {pending ? "Saving…" : editing ? "Save changes" : "Save draft"}
          </button>
        </div>
      </form>
    </Card>
  );
}
