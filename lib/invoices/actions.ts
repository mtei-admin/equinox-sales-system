"use server";

import { revalidatePath } from "next/cache";
import { AuthError, assertPermission } from "@/lib/auth/guards";
import { getSalesOrder } from "@/lib/data/queries";
import { cancelInvoice, createInvoice, postInvoice } from "@/lib/documents/rpc";
import { assertCanCreateInvoice } from "@/lib/sales-orders/allocation";
import { cancelDocumentSchema, invoiceSchema } from "@/lib/validation/schemas";

export type InvoiceActionResult = { ok: true; id: string } | { ok: false; error: string };
export type InvoiceStatusResult = { ok: true } | { ok: false; error: string };

export type InvoiceSourceLine = {
  sales_order_item_id: string;
  description: string | null;
  model: string | null;
  uom: string;
  unit_price: number;
  ordered: number;
  invoiced: number;
  remaining: number;
};

export type InvoiceSource =
  | {
      ok: true;
      sales_order_id: string;
      so_number: string;
      customer_name: string;
      remaining_qty: number;
      lines: InvoiceSourceLine[];
    }
  | { ok: false; error: string };

function denied(err: unknown): { ok: false; error: string } {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Request failed" };
}

function parseJsonPayload(formData: FormData) {
  const raw = String(formData.get("payload") || "");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function revalidateInvoice(id?: string, salesOrderId?: string) {
  revalidatePath("/invoices");
  if (id) revalidatePath(`/invoices/${id}`);
  revalidatePath("/sales-orders");
  if (salesOrderId) revalidatePath(`/sales-orders/${salesOrderId}`);
}

export async function loadInvoiceSource(salesOrderId: string): Promise<InvoiceSource> {
  try {
    await assertPermission("invoices.write");
  } catch (err) {
    return denied(err);
  }
  if (!salesOrderId) return { ok: false, error: "Select a sales order" };
  const order = await getSalesOrder(salesOrderId);
  if (!order) return { ok: false, error: "Sales order not found" };
  if (order.status !== "open") return { ok: false, error: "Sales order must be open to invoice" };
  const lines = order.sales_order_items
    .filter((line) => line.remaining_qty > 0)
    .map((line) => ({
      sales_order_item_id: line.id,
      description: line.description,
      model: line.model,
      uom: line.uom,
      unit_price: line.unit_price,
      ordered: line.quantity,
      invoiced: line.invoiced_qty,
      remaining: line.remaining_qty,
    }));
  if (lines.length === 0) {
    return { ok: false, error: "Sales order is already fully invoiced" };
  }
  return {
    ok: true,
    sales_order_id: order.id,
    so_number: order.so_number,
    customer_name: order.customer_name,
    remaining_qty: order.remaining_qty,
    lines,
  };
}

export async function saveInvoice(formData: FormData): Promise<InvoiceActionResult> {
  try {
    await assertPermission("invoices.write");
  } catch (err) {
    return denied(err);
  }

  const payload = parseJsonPayload(formData);
  const parsed = invoiceSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid invoice" };
  }

  const order = await getSalesOrder(parsed.data.sales_order_id);
  if (!order) return { ok: false, error: "Sales order not found" };

  const soLines = order.sales_order_items.map((line) => ({ id: line.id, quantity: line.quantity }));
  const existing = order.sales_order_items.flatMap((line) =>
    line.invoiced_qty > 0
      ? [{ sales_order_item_id: line.id, quantity: line.invoiced_qty, invoice_status: "posted" as const }]
      : [],
  );
  try {
    assertCanCreateInvoice(
      order.status,
      soLines,
      existing,
      parsed.data.lines.map((line) => ({
        sales_order_item_id: line.sales_order_item_id,
        quantity: line.quantity,
      })),
    );
  } catch (err) {
    return denied(err);
  }

  try {
    const id = await createInvoice({
      sales_order_id: parsed.data.sales_order_id,
      invoice_number: parsed.data.invoice_number,
      remarks: parsed.data.remarks || "",
      lines: parsed.data.lines,
    });
    revalidateInvoice(id, parsed.data.sales_order_id);
    return { ok: true, id };
  } catch (err) {
    return denied(err);
  }
}

export async function postInvoiceAction(formData: FormData): Promise<InvoiceStatusResult> {
  try {
    await assertPermission("invoices.write");
  } catch (err) {
    return denied(err);
  }
  const id = String(formData.get("id") || "");
  if (!id) return { ok: false, error: "Invoice is required" };
  try {
    await postInvoice(id);
    revalidateInvoice(id);
    return { ok: true };
  } catch (err) {
    return denied(err);
  }
}

export async function cancelInvoiceAction(formData: FormData): Promise<InvoiceStatusResult> {
  try {
    await assertPermission("invoices.write");
  } catch (err) {
    return denied(err);
  }
  const parsed = cancelDocumentSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid cancellation" };
  }
  try {
    await cancelInvoice(parsed.data.id, parsed.data.reason);
    revalidateInvoice(parsed.data.id);
    return { ok: true };
  } catch (err) {
    return denied(err);
  }
}
