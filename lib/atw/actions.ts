"use server";

import { revalidatePath } from "next/cache";
import { AuthError, assertPermission } from "@/lib/auth/guards";
import { getInvoice } from "@/lib/data/queries";
import { cancelAtwDocument, createAtwDocument, releaseAtwDocument } from "@/lib/documents/rpc";
import { assertCanCreateAtw } from "@/lib/atw/allocation";
import { atwSchema, cancelDocumentSchema } from "@/lib/validation/schemas";

export type AtwActionResult = { ok: true; id: string } | { ok: false; error: string };
export type AtwStatusResult = { ok: true } | { ok: false; error: string };

export type AtwSourceLine = {
  invoice_item_id: string;
  description: string | null;
  model: string | null;
  uom: string;
  unit_price: number;
  invoiced: number;
  allocated: number;
  remaining: number;
};

export type AtwSource =
  | {
      ok: true;
      invoice_id: string;
      invoice_number: string;
      customer_name: string;
      remaining_qty: number;
      lines: AtwSourceLine[];
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

function revalidateAtw(id?: string, invoiceId?: string) {
  revalidatePath("/atw-dr");
  if (id) revalidatePath(`/atw-dr/${id}`);
  revalidatePath("/invoices");
  if (invoiceId) revalidatePath(`/invoices/${invoiceId}`);
}

export async function loadAtwSource(invoiceId: string): Promise<AtwSource> {
  try {
    await assertPermission("atw-dr.write");
  } catch (err) {
    return denied(err);
  }
  if (!invoiceId) return { ok: false, error: "Select an invoice" };
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return { ok: false, error: "Invoice not found" };
  if (invoice.status !== "posted") return { ok: false, error: "Invoice must be posted to create ATW/DR" };
  const lines = invoice.invoice_items
    .filter((line) => line.remaining_qty > 0)
    .map((line) => ({
      invoice_item_id: line.id,
      description: line.description,
      model: line.model,
      uom: line.uom,
      unit_price: line.unit_price,
      invoiced: line.quantity,
      allocated: line.atw_qty,
      remaining: line.remaining_qty,
    }));
  if (lines.length === 0) {
    return { ok: false, error: "Invoice is already fully allocated to ATW/DR" };
  }
  return {
    ok: true,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    customer_name: invoice.customer_name,
    remaining_qty: invoice.remaining_qty,
    lines,
  };
}

export async function saveAtw(formData: FormData): Promise<AtwActionResult> {
  try {
    await assertPermission("atw-dr.write");
  } catch (err) {
    return denied(err);
  }

  const payload = parseJsonPayload(formData);
  const parsed = atwSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid ATW/DR" };
  }

  const invoice = await getInvoice(parsed.data.invoice_id);
  if (!invoice) return { ok: false, error: "Invoice not found" };

  const invoiceLines = invoice.invoice_items.map((line) => ({ id: line.id, quantity: line.quantity }));
  const existing = invoice.invoice_items.flatMap((line) =>
    line.atw_qty > 0
      ? [{ invoice_item_id: line.id, quantity: line.atw_qty, atw_status: "released" as const }]
      : [],
  );
  try {
    assertCanCreateAtw(
      invoice.status,
      invoiceLines,
      existing,
      parsed.data.lines.map((line) => ({
        invoice_item_id: line.invoice_item_id,
        quantity: line.quantity,
      })),
    );
  } catch (err) {
    return denied(err);
  }

  try {
    const id = await createAtwDocument({
      invoice_id: parsed.data.invoice_id,
      document_type: parsed.data.document_type,
      remarks: parsed.data.remarks || "",
      lines: parsed.data.lines,
    });
    revalidateAtw(id, parsed.data.invoice_id);
    return { ok: true, id };
  } catch (err) {
    return denied(err);
  }
}

export async function releaseAtwAction(formData: FormData): Promise<AtwStatusResult> {
  try {
    await assertPermission("atw-dr.write");
  } catch (err) {
    return denied(err);
  }
  const id = String(formData.get("id") || "");
  if (!id) return { ok: false, error: "ATW/DR is required" };
  try {
    await releaseAtwDocument(id);
    revalidateAtw(id);
    return { ok: true };
  } catch (err) {
    return denied(err);
  }
}

export async function cancelAtwAction(formData: FormData): Promise<AtwStatusResult> {
  try {
    await assertPermission("atw-dr.write");
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
    await cancelAtwDocument(parsed.data.id, parsed.data.reason);
    revalidateAtw(parsed.data.id);
    return { ok: true };
  } catch (err) {
    return denied(err);
  }
}
