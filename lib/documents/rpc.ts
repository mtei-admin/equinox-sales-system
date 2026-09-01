import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function callRpc<T>(fn: string, args: Record<string, unknown>) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function createSalesOrder(payload: Record<string, unknown>) {
  return callRpc<string>("create_sales_order", { payload });
}

export function updateSalesOrder(id: string, payload: Record<string, unknown>) {
  return callRpc<string>("update_sales_order", { p_id: id, payload });
}

export function openSalesOrder(id: string) {
  return callRpc<void>("open_sales_order", { p_id: id });
}

export function cancelSalesOrder(id: string, reason: string) {
  return callRpc<void>("cancel_sales_order", { p_id: id, p_reason: reason });
}

export function createInvoice(payload: Record<string, unknown>) {
  return callRpc<string>("create_invoice", { payload });
}

export function postInvoice(id: string) {
  return callRpc<void>("post_invoice", { p_id: id });
}

export function cancelInvoice(id: string, reason: string) {
  return callRpc<void>("cancel_invoice", { p_id: id, p_reason: reason });
}

export function createAtwDocument(payload: Record<string, unknown>) {
  return callRpc<string>("create_atw_document", { payload });
}

export function releaseAtwDocument(id: string) {
  return callRpc<void>("release_atw_document", { p_id: id });
}

export function cancelAtwDocument(id: string, reason: string) {
  return callRpc<void>("cancel_atw_document", { p_id: id, p_reason: reason });
}

export function createWithdrawalSlip(payload: Record<string, unknown>) {
  return callRpc<string>("create_withdrawal_slip", { payload });
}

export function updateWithdrawalSlip(id: string, payload: Record<string, unknown>) {
  return callRpc<string>("update_withdrawal_slip", { p_id: id, payload });
}

export function issueWithdrawalSlip(id: string) {
  return callRpc<void>("issue_withdrawal_slip", { p_id: id });
}

export function cancelWithdrawalSlip(id: string, reason: string) {
  return callRpc<void>("cancel_withdrawal_slip", { p_id: id, p_reason: reason });
}
