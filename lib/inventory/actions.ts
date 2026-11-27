"use server";

import { revalidatePath } from "next/cache";
import { AuthError, assertPermission } from "@/lib/auth/guards";
import {
  cancelInventoryAdjustment,
  createInventoryAdjustment,
  enrollInventoryUnit,
  postInventoryAdjustment,
  updateInventoryAdjustment,
} from "@/lib/documents/rpc";
import {
  cancelDocumentSchema,
  inventoryAdjustmentSchema,
  enrollUnitSchema,
  postInventoryAdjustmentSchema,
  updateInventoryAdjustmentSchema,
} from "@/lib/validation/schemas";

export type AdjustmentActionResult = { ok: true; id: string } | { ok: false; error: string };
export type AdjustmentStatusResult = { ok: true } | { ok: false; error: string };

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

function revalidateAdjustment(id?: string) {
  revalidatePath("/inventory");
  revalidatePath("/inventory/adjustments");
  if (id) {
    revalidatePath(`/inventory/adjustments/${id}`);
    revalidatePath(`/inventory/adjustments/${id}/edit`);
  }
  revalidatePath("/items");
  revalidatePath("/sales-orders");
}

export async function saveInventoryAdjustment(formData: FormData): Promise<AdjustmentActionResult> {
  try {
    await assertPermission("inventory.write");
  } catch (err) {
    return denied(err);
  }

  const payload = parseJsonPayload(formData);
  if (payload && typeof payload === "object" && "id" in payload) {
    const parsed = updateInventoryAdjustmentSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid adjustment" };
    }
    try {
      const id = await updateInventoryAdjustment(parsed.data.id, {
        remarks: parsed.data.remarks || "",
        lines: parsed.data.lines,
      });
      revalidateAdjustment(id);
      return { ok: true, id };
    } catch (err) {
      return denied(err);
    }
  }

  const parsed = inventoryAdjustmentSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid adjustment" };
  }
  try {
    const id = await createInventoryAdjustment({
      warehouse_id: parsed.data.warehouse_id,
      remarks: parsed.data.remarks || "",
      lines: parsed.data.lines,
    });
    revalidateAdjustment(id);
    return { ok: true, id };
  } catch (err) {
    return denied(err);
  }
}

export async function postInventoryAdjustmentAction(formData: FormData): Promise<AdjustmentStatusResult> {
  try {
    await assertPermission("inventory.write");
  } catch (err) {
    return denied(err);
  }
  const parsed = postInventoryAdjustmentSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid posting" };
  }
  try {
    await postInventoryAdjustment(parsed.data.id, parsed.data.reason);
    revalidateAdjustment(parsed.data.id);
    return { ok: true };
  } catch (err) {
    return denied(err);
  }
}

export async function cancelInventoryAdjustmentAction(formData: FormData): Promise<AdjustmentStatusResult> {
  try {
    await assertPermission("inventory.write");
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
    await cancelInventoryAdjustment(parsed.data.id, parsed.data.reason);
    revalidateAdjustment(parsed.data.id);
    return { ok: true };
  } catch (err) {
    return denied(err);
  }
}

export async function enrollInventoryUnitAction(formData: FormData): Promise<void> {
  await assertPermission("inventory.write");
  const parsed = enrollUnitSchema.safeParse({
    item_id: formData.get("item_id"),
    warehouse_id: formData.get("warehouse_id") || "",
    identifier: formData.get("identifier"),
    identifier_kind: formData.get("identifier_kind"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid unit");
  }
  await enrollInventoryUnit({
    item_id: parsed.data.item_id,
    warehouse_id: parsed.data.warehouse_id || null,
    identifier: parsed.data.identifier,
    identifier_kind: parsed.data.identifier_kind,
  });
  revalidatePath("/inventory/reconciliation");
  revalidatePath("/inventory");
  const { redirect } = await import("next/navigation");
  redirect("/inventory/reconciliation");
}
