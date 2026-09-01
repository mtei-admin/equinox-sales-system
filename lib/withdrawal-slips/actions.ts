"use server";

import { revalidatePath } from "next/cache";
import { AuthError, assertPermission } from "@/lib/auth/guards";
import { getAtw, getWithdrawalSlip } from "@/lib/data/queries";
import {
  cancelWithdrawalSlip,
  createWithdrawalSlip,
  issueWithdrawalSlip,
  updateWithdrawalSlip,
} from "@/lib/documents/rpc";
import {
  assertCanCreateWithdrawalSlip,
  assertCanUpdateWithdrawalSlip,
} from "@/lib/withdrawal-slips/eligibility";
import { cancelDocumentSchema, updateWithdrawalSlipSchema, withdrawalSlipSchema } from "@/lib/validation/schemas";

export type WsActionResult = { ok: true; id: string } | { ok: false; error: string };
export type WsStatusResult = { ok: true } | { ok: false; error: string };

export type WsSourceLine = {
  atw_item_id: string;
  description: string | null;
  model: string | null;
  uom: string;
  unit_price: number;
  quantity: number;
};

export type WsSource =
  | {
      ok: true;
      atw_id: string;
      atw_number: string;
      document_type: string;
      customer_name: string;
      lines: WsSourceLine[];
    }
  | { ok: false; error: string; existingId?: string };

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

function revalidateWs(id?: string, atwId?: string) {
  revalidatePath("/withdrawal-slips");
  if (id) {
    revalidatePath(`/withdrawal-slips/${id}`);
    revalidatePath(`/withdrawal-slips/${id}/edit`);
  }
  revalidatePath("/atw-dr");
  if (atwId) revalidatePath(`/atw-dr/${atwId}`);
}

export async function loadWsSource(atwId: string): Promise<WsSource> {
  try {
    await assertPermission("withdrawal-slips.write");
  } catch (err) {
    return denied(err);
  }
  if (!atwId) return { ok: false, error: "Select an ATW/DR" };
  const doc = await getAtw(atwId);
  if (!doc) return { ok: false, error: "ATW/DR not found" };
  try {
    assertCanCreateWithdrawalSlip(
      doc.status,
      Boolean(doc.active_withdrawal_slip_id),
      doc.atw_document_items.map((line) => ({ id: line.id, quantity: line.quantity })),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cannot create withdrawal slip";
    return {
      ok: false,
      error: message,
      existingId: doc.active_withdrawal_slip_id ?? undefined,
    };
  }
  return {
    ok: true,
    atw_id: doc.id,
    atw_number: doc.atw_number,
    document_type: doc.document_type,
    customer_name: doc.customer_name,
    lines: doc.atw_document_items.map((line) => ({
      atw_item_id: line.id,
      description: line.description,
      model: line.model,
      uom: line.uom,
      unit_price: line.unit_price,
      quantity: line.quantity,
    })),
  };
}

export async function saveWithdrawalSlip(formData: FormData): Promise<WsActionResult> {
  try {
    await assertPermission("withdrawal-slips.write");
  } catch (err) {
    return denied(err);
  }

  const payload = parseJsonPayload(formData);
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const editing = Boolean(record && typeof record.id === "string" && record.id.length > 0);
  const parsed = editing ? updateWithdrawalSlipSchema.safeParse(payload) : withdrawalSlipSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid withdrawal slip" };
  }

  try {
    if (editing && "id" in parsed.data) {
      const slip = await getWithdrawalSlip(parsed.data.id);
      if (!slip) return { ok: false, error: "Withdrawal slip not found" };
      assertCanUpdateWithdrawalSlip(slip.status);
      const atw = await getAtw(slip.atw_id);
      if (!atw) return { ok: false, error: "ATW/DR not found" };
      assertCanCreateWithdrawalSlip(
        atw.status,
        atw.active_withdrawal_slip_id !== null && atw.active_withdrawal_slip_id !== slip.id,
        atw.atw_document_items.map((line) => ({ id: line.id, quantity: line.quantity })),
        parsed.data.lines,
      );
      const id = await updateWithdrawalSlip(parsed.data.id, {
        remarks: parsed.data.remarks || "",
        lines: parsed.data.lines ?? [],
      });
      revalidateWs(id, slip.atw_id);
      return { ok: true, id };
    }

    if (!("atw_id" in parsed.data)) return { ok: false, error: "Select an ATW/DR" };
    const atw = await getAtw(parsed.data.atw_id);
    if (!atw) return { ok: false, error: "ATW/DR not found" };
    assertCanCreateWithdrawalSlip(
      atw.status,
      Boolean(atw.active_withdrawal_slip_id),
      atw.atw_document_items.map((line) => ({ id: line.id, quantity: line.quantity })),
      parsed.data.lines,
    );
    const id = await createWithdrawalSlip({
      atw_id: parsed.data.atw_id,
      remarks: parsed.data.remarks || "",
      lines: parsed.data.lines ?? atw.atw_document_items.map((line) => ({
        atw_item_id: line.id,
        quantity: line.quantity,
      })),
    });
    revalidateWs(id, parsed.data.atw_id);
    return { ok: true, id };
  } catch (err) {
    return denied(err);
  }
}

export async function issueWithdrawalSlipAction(formData: FormData): Promise<WsStatusResult> {
  try {
    await assertPermission("withdrawal-slips.write");
  } catch (err) {
    return denied(err);
  }
  const id = String(formData.get("id") || "");
  if (!id) return { ok: false, error: "Withdrawal slip is required" };
  try {
    await issueWithdrawalSlip(id);
    revalidateWs(id);
    return { ok: true };
  } catch (err) {
    return denied(err);
  }
}

export async function cancelWithdrawalSlipAction(formData: FormData): Promise<WsStatusResult> {
  try {
    await assertPermission("withdrawal-slips.write");
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
    await cancelWithdrawalSlip(parsed.data.id, parsed.data.reason);
    revalidateWs(parsed.data.id);
    return { ok: true };
  } catch (err) {
    return denied(err);
  }
}
