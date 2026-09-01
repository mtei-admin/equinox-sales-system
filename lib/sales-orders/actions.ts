"use server";

import { revalidatePath } from "next/cache";
import { AuthError, assertPermission } from "@/lib/auth/guards";
import { cancelSalesOrder, createSalesOrder, openSalesOrder, updateSalesOrder } from "@/lib/documents/rpc";
import { cancelDocumentSchema, salesOrderSchema, updateSalesOrderSchema } from "@/lib/validation/schemas";
import type { z } from "zod";

export type SalesOrderResult = { ok: true; id: string } | { ok: false; error: string };
export type SalesOrderStatusResult = { ok: true } | { ok: false; error: string };

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

function toRpcPayload(data: z.infer<typeof salesOrderSchema>, actorId: string) {
  return {
    customer_id: data.customer_id,
    delivery_address: data.delivery_address || "",
    order_date: data.order_date,
    term: data.term || "",
    reference_no: data.reference_no || "",
    order_type: data.order_type || "",
    sales_employee_id: data.sales_employee_id || actorId,
    remarks: data.remarks || "",
    lines: data.lines.map((line) => ({
      item_id: line.item_id,
      quantity: line.quantity,
      unit_price: line.unit_price,
      uom: line.uom || "PCS",
      model: line.model || "",
      serial_no: line.serial_no || "",
      barcode: line.barcode || "",
      description: line.description || "",
    })),
  };
}

function revalidateOrder(id?: string) {
  revalidatePath("/sales-orders");
  if (id) {
    revalidatePath(`/sales-orders/${id}`);
    revalidatePath(`/sales-orders/${id}/edit`);
  }
}

export async function saveSalesOrder(formData: FormData): Promise<SalesOrderResult> {
  let profile;
  try {
    profile = await assertPermission("sales-orders.write");
  } catch (err) {
    return denied(err);
  }

  const payload = parseJsonPayload(formData);
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid sales order" };
  }

  const record = payload as Record<string, unknown>;
  const editing = typeof record.id === "string" && record.id.length > 0;
  const parsed = editing ? updateSalesOrderSchema.safeParse(payload) : salesOrderSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid sales order" };
  }

  try {
    const rpcPayload = toRpcPayload(parsed.data, profile.id);
    const id = editing
      ? await updateSalesOrder((parsed.data as z.infer<typeof updateSalesOrderSchema>).id, rpcPayload)
      : await createSalesOrder(rpcPayload);
    revalidateOrder(id);
    return { ok: true, id };
  } catch (err) {
    return denied(err);
  }
}

export async function openSalesOrderAction(formData: FormData): Promise<SalesOrderStatusResult> {
  try {
    await assertPermission("sales-orders.write");
  } catch (err) {
    return denied(err);
  }
  const id = String(formData.get("id") || "");
  if (!id) return { ok: false, error: "Sales order is required" };
  try {
    await openSalesOrder(id);
    revalidateOrder(id);
    return { ok: true };
  } catch (err) {
    return denied(err);
  }
}

export async function cancelSalesOrderAction(formData: FormData): Promise<SalesOrderStatusResult> {
  try {
    await assertPermission("sales-orders.write");
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
    await cancelSalesOrder(parsed.data.id, parsed.data.reason);
    revalidateOrder(parsed.data.id);
    return { ok: true };
  } catch (err) {
    return denied(err);
  }
}
