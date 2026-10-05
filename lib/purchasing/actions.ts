"use server";

import { revalidatePath } from "next/cache";
import { AuthError, assertPermission } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  billOfLadingSchema,
  purchaseOrderSchema,
  receivingReportSchema,
  supplierSchema,
} from "@/lib/validation/schemas";
import type { Permission } from "@/lib/permissions/policies";

type Ok = { ok: true; id?: string };
type Fail = { ok: false; error: string };

function fail(err: unknown): Fail {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  if (err instanceof Error) {
    const text = err.message.replace(/^.*ERROR:\s*/i, "").trim();
    return { ok: false, error: text || "Request failed" };
  }
  return { ok: false, error: "Request failed" };
}

function empty(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function revalidatePurchasing(paths: string[]) {
  for (const path of ["/suppliers", "/purchase-orders", "/bills-of-lading", "/receiving-reports", "/inventory", ...paths]) {
    revalidatePath(path);
  }
}

async function guard(permission: Permission) {
  return assertPermission(permission);
}

export async function createSupplier(formData: FormData): Promise<Ok | Fail> {
  try {
    const profile = await guard("suppliers.write");
    const parsed = supplierSchema.safeParse({
      name: formData.get("name"),
      address: formData.get("address") || "",
      contact_person: formData.get("contact_person") || "",
      contact_number: formData.get("contact_number") || "",
      email: formData.get("email") || "",
      tin_number: formData.get("tin_number") || "",
      payment_terms: formData.get("payment_terms") || "",
      remarks: formData.get("remarks") || "",
      status: formData.get("status") || "active",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid supplier" };
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("suppliers").insert({
      supplier_code: "",
      name: parsed.data.name,
      address: empty(parsed.data.address),
      contact_person: empty(parsed.data.contact_person),
      contact_number: empty(parsed.data.contact_number),
      email: empty(parsed.data.email),
      tin_number: empty(parsed.data.tin_number),
      payment_terms: empty(parsed.data.payment_terms),
      remarks: empty(parsed.data.remarks),
      status: parsed.data.status,
      created_by: profile.id,
      updated_by: profile.id,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePurchasing([]);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function updateSupplier(formData: FormData): Promise<Ok | Fail> {
  try {
    const profile = await guard("suppliers.write");
    const id = String(formData.get("id") || "");
    const parsed = supplierSchema.safeParse({
      name: formData.get("name"),
      address: formData.get("address") || "",
      contact_person: formData.get("contact_person") || "",
      contact_number: formData.get("contact_number") || "",
      email: formData.get("email") || "",
      tin_number: formData.get("tin_number") || "",
      payment_terms: formData.get("payment_terms") || "",
      remarks: formData.get("remarks") || "",
      status: formData.get("status") || "active",
    });
    if (!id) return { ok: false, error: "Supplier is required" };
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid supplier" };
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("suppliers")
      .update({
        name: parsed.data.name,
        address: empty(parsed.data.address),
        contact_person: empty(parsed.data.contact_person),
        contact_number: empty(parsed.data.contact_number),
        email: empty(parsed.data.email),
        tin_number: empty(parsed.data.tin_number),
        payment_terms: empty(parsed.data.payment_terms),
        remarks: empty(parsed.data.remarks),
        status: parsed.data.status,
        updated_by: profile.id,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePurchasing([`/suppliers/${id}`]);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as string;
}

export async function savePurchaseOrder(formData: FormData): Promise<Ok | Fail> {
  try {
    await guard("purchase-orders.write");
    const raw = JSON.parse(String(formData.get("payload") || "{}")) as unknown;
    const parsed = purchaseOrderSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid purchase order" };
    const id = String(formData.get("id") || "");
    const saved = id
      ? await rpc("update_purchase_order", { p_id: id, payload: parsed.data })
      : await rpc("create_purchase_order", { payload: parsed.data });
    revalidatePurchasing([`/purchase-orders/${saved}`]);
    return { ok: true, id: saved };
  } catch (err) {
    return fail(err);
  }
}

export async function purchaseOrderAction(formData: FormData): Promise<Ok | Fail> {
  try {
    await guard("purchase-orders.write");
    const id = String(formData.get("id") || "");
    const action = String(formData.get("action") || "");
    const reason = String(formData.get("reason") || "");
    if (action === "submit") await rpc("submit_purchase_order", { p_id: id });
    else if (action === "approve") await rpc("approve_purchase_order", { p_id: id });
    else if (action === "close") await rpc("close_purchase_order", { p_id: id });
    else if (action === "cancel") await rpc("cancel_purchase_order", { p_id: id, p_reason: reason });
    else return { ok: false, error: "Unknown action" };
    revalidatePurchasing([`/purchase-orders/${id}`]);
    return { ok: true, id };
  } catch (err) {
    return fail(err);
  }
}

export async function saveBillOfLading(formData: FormData): Promise<Ok | Fail> {
  try {
    await guard("bills-of-lading.write");
    const raw = JSON.parse(String(formData.get("payload") || "{}")) as unknown;
    const parsed = billOfLadingSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid bill of lading" };
    const saved = await rpc("create_bill_of_lading", { payload: parsed.data });
    revalidatePurchasing([`/bills-of-lading/${saved}`, `/purchase-orders/${parsed.data.purchase_order_id}`]);
    return { ok: true, id: saved };
  } catch (err) {
    return fail(err);
  }
}

export async function billOfLadingAction(formData: FormData): Promise<Ok | Fail> {
  try {
    await guard("bills-of-lading.write");
    const id = String(formData.get("id") || "");
    const action = String(formData.get("action") || "");
    const reason = String(formData.get("reason") || "");
    if (action === "post") await rpc("post_bill_of_lading", { p_id: id });
    else if (action === "transit") await rpc("mark_bill_of_lading_transit", { p_id: id });
    else if (action === "arrived") await rpc("mark_bill_of_lading_arrived", { p_id: id });
    else if (action === "cancel") await rpc("cancel_bill_of_lading", { p_id: id, p_reason: reason });
    else return { ok: false, error: "Unknown action" };
    revalidatePurchasing([`/bills-of-lading/${id}`]);
    return { ok: true, id };
  } catch (err) {
    return fail(err);
  }
}

export async function saveReceivingReport(formData: FormData): Promise<Ok | Fail> {
  try {
    await guard("receiving-reports.write");
    const raw = JSON.parse(String(formData.get("payload") || "{}")) as unknown;
    const parsed = receivingReportSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid receiving report" };
    const saved = await rpc("create_receiving_report", { payload: parsed.data });
    revalidatePurchasing([`/receiving-reports/${saved}`, `/bills-of-lading/${parsed.data.bill_of_lading_id}`]);
    return { ok: true, id: saved };
  } catch (err) {
    return fail(err);
  }
}

export async function receivingReportAction(formData: FormData): Promise<Ok | Fail> {
  try {
    await guard("receiving-reports.write");
    const id = String(formData.get("id") || "");
    const action = String(formData.get("action") || "");
    const reason = String(formData.get("reason") || "");
    if (action === "post") await rpc("post_receiving_report", { p_id: id });
    else if (action === "cancel") await rpc("cancel_receiving_report", { p_id: id, p_reason: reason });
    else return { ok: false, error: "Unknown action" };
    revalidatePurchasing([`/receiving-reports/${id}`]);
    return { ok: true, id };
  } catch (err) {
    return fail(err);
  }
}

export async function resolveDiscrepancy(formData: FormData): Promise<Ok | Fail> {
  try {
    await guard("receiving-reports.write");
    const id = String(formData.get("id") || "");
    const reportId = String(formData.get("report_id") || "");
    const status = String(formData.get("status") || "");
    const remarks = String(formData.get("remarks") || "");
    await rpc("resolve_receiving_discrepancy", { p_id: id, p_status: status, p_remarks: remarks });
    revalidatePurchasing([`/receiving-reports/${reportId}`]);
    return { ok: true, id };
  } catch (err) {
    return fail(err);
  }
}
