"use server";

import { revalidatePath } from "next/cache";
import { AuthError, assertPermission } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { customerSchema, itemSchema } from "@/lib/validation/schemas";

export type MasterDataResult = { ok: true } | { ok: false; error: string };

function denied(err: unknown): MasterDataResult {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  throw err;
}

function emptyToNull(value: string | undefined) {
  return value ? value : null;
}

export async function createCustomer(formData: FormData): Promise<MasterDataResult> {
  let profile;
  try {
    profile = await assertPermission("customers.write");
  } catch (err) {
    return denied(err);
  }
  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    billing_address: formData.get("billing_address") || "",
    tin_number: formData.get("tin_number") || "",
    contact_person: formData.get("contact_person") || "",
    contact_number: formData.get("contact_number") || "",
    status: formData.get("status") || "active",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid customer" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("customers").insert({
    name: parsed.data.name,
    billing_address: emptyToNull(parsed.data.billing_address),
    tin_number: emptyToNull(parsed.data.tin_number),
    contact_person: emptyToNull(parsed.data.contact_person),
    contact_number: emptyToNull(parsed.data.contact_number),
    status: parsed.data.status,
    created_by: profile.id,
    updated_by: profile.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/customers");
  return { ok: true };
}

export async function updateCustomer(formData: FormData): Promise<MasterDataResult> {
  let profile;
  try {
    profile = await assertPermission("customers.write");
  } catch (err) {
    return denied(err);
  }
  const id = String(formData.get("id") || "");
  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    billing_address: formData.get("billing_address") || "",
    tin_number: formData.get("tin_number") || "",
    contact_person: formData.get("contact_person") || "",
    contact_number: formData.get("contact_number") || "",
    status: formData.get("status") || "active",
  });
  if (!id) return { ok: false, error: "Customer is required" };
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid customer" };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .update({
      name: parsed.data.name,
      billing_address: emptyToNull(parsed.data.billing_address),
      tin_number: emptyToNull(parsed.data.tin_number),
      contact_person: emptyToNull(parsed.data.contact_person),
      contact_number: emptyToNull(parsed.data.contact_number),
      status: parsed.data.status,
      updated_by: profile.id,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Customer not found" };

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

export async function createItem(formData: FormData): Promise<MasterDataResult> {
  let profile;
  try {
    profile = await assertPermission("items.write");
  } catch (err) {
    return denied(err);
  }
  const parsed = itemSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || "",
    brand: formData.get("brand") || "",
    model: formData.get("model") || "",
    serial_no: formData.get("serial_no") || "",
    barcode: formData.get("barcode") || "",
    status: formData.get("status") || "active",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("items").insert({
    name: parsed.data.name,
    description: emptyToNull(parsed.data.description),
    brand: emptyToNull(parsed.data.brand),
    model: emptyToNull(parsed.data.model),
    serial_no: emptyToNull(parsed.data.serial_no),
    barcode: emptyToNull(parsed.data.barcode),
    status: parsed.data.status,
    created_by: profile.id,
    updated_by: profile.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/items");
  return { ok: true };
}

export async function updateItem(formData: FormData): Promise<MasterDataResult> {
  let profile;
  try {
    profile = await assertPermission("items.write");
  } catch (err) {
    return denied(err);
  }
  const id = String(formData.get("id") || "");
  const parsed = itemSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || "",
    brand: formData.get("brand") || "",
    model: formData.get("model") || "",
    serial_no: formData.get("serial_no") || "",
    barcode: formData.get("barcode") || "",
    status: formData.get("status") || "active",
  });
  if (!id) return { ok: false, error: "Item is required" };
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item" };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .update({
      name: parsed.data.name,
      description: emptyToNull(parsed.data.description),
      brand: emptyToNull(parsed.data.brand),
      model: emptyToNull(parsed.data.model),
      serial_no: emptyToNull(parsed.data.serial_no),
      barcode: emptyToNull(parsed.data.barcode),
      status: parsed.data.status,
      updated_by: profile.id,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Item not found" };

  revalidatePath("/items");
  revalidatePath(`/items/${id}`);
  return { ok: true };
}
