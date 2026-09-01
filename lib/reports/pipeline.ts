import { invoiceHeaderRemaining } from "@/lib/atw/allocation";
import { soHeaderRemaining } from "@/lib/sales-orders/allocation";
import type { AtwStatus, InvoiceStatus, SoStatus, WsStatus } from "@/types/database";

export type PipelineOrder = {
  id: string;
  so_number: string;
  customer_id: string;
  customer_name: string;
  order_date: string;
  sales_employee_id: string | null;
  sales_employee_name: string | null;
  status: SoStatus;
  total_quantity: number;
  grand_total: number;
  remaining_qty: number;
};

export type PipelineInvoice = {
  id: string;
  invoice_number: string;
  sales_order_id: string;
  customer_id: string;
  customer_name: string;
  order_date: string;
  sales_employee_id: string | null;
  sales_employee_name: string | null;
  status: InvoiceStatus;
  total_quantity: number;
  grand_total: number;
  remaining_qty: number;
};

export type PipelineAtw = {
  id: string;
  atw_number: string;
  document_type: string;
  invoice_id: string;
  customer_id: string;
  customer_name: string;
  order_date: string;
  sales_employee_id: string | null;
  sales_employee_name: string | null;
  status: AtwStatus;
  total_quantity: number;
  grand_total: number;
  has_active_slip: boolean;
  active_withdrawal_slip_id: string | null;
};

export type PipelineSlip = {
  id: string;
  ws_number: string;
  atw_id: string;
  customer_id: string;
  customer_name: string;
  order_date: string;
  sales_employee_id: string | null;
  sales_employee_name: string | null;
  status: WsStatus;
  total_quantity: number;
  grand_total: number;
};

export function remainingSalesOrders(orders: PipelineOrder[]) {
  return orders.filter((order) => order.status !== "cancelled" && order.remaining_qty > 0);
}

export function remainingInvoices(invoices: PipelineInvoice[]) {
  return invoices.filter((invoice) => invoice.status === "posted" && invoice.remaining_qty > 0);
}

export function atwAwaitingWithdrawal(docs: PipelineAtw[]) {
  return docs.filter((doc) => doc.status === "released" && !doc.has_active_slip);
}

export type PipelineTotals = {
  remaining_so_count: number;
  remaining_so_qty: number;
  remaining_invoice_count: number;
  remaining_invoice_qty: number;
  awaiting_withdrawal_count: number;
};

export function pipelineTotals(orders: PipelineOrder[], invoices: PipelineInvoice[], atw: PipelineAtw[]): PipelineTotals {
  const so = remainingSalesOrders(orders);
  const inv = remainingInvoices(invoices);
  const awaiting = atwAwaitingWithdrawal(atw);
  return {
    remaining_so_count: so.length,
    remaining_so_qty: so.reduce((sum, row) => sum + row.remaining_qty, 0),
    remaining_invoice_count: inv.length,
    remaining_invoice_qty: inv.reduce((sum, row) => sum + row.remaining_qty, 0),
    awaiting_withdrawal_count: awaiting.length,
  };
}

export function computeSoRemaining(
  lines: { id: string; quantity: number }[],
  invoiceLines: { sales_order_item_id: string; quantity: number; invoice_status: InvoiceStatus }[],
) {
  return soHeaderRemaining(lines, invoiceLines);
}

export function computeInvoiceRemaining(
  lines: { id: string; quantity: number }[],
  atwLines: { invoice_item_id: string; quantity: number; atw_status: AtwStatus }[],
) {
  return invoiceHeaderRemaining(lines, atwLines);
}

export function salesPendingActions(orders: PipelineOrder[], invoices: PipelineInvoice[], atw: PipelineAtw[]) {
  return {
    draft_orders: orders.filter((row) => row.status === "draft"),
    open_orders: orders.filter((row) => row.status === "open" && row.remaining_qty > 0),
    draft_invoices: invoices.filter((row) => row.status === "draft"),
    posted_invoices: invoices.filter((row) => row.status === "posted" && row.remaining_qty > 0),
    draft_atw: atw.filter((row) => row.status === "draft"),
  };
}

export function warehousePendingActions(atw: PipelineAtw[], slips: PipelineSlip[]) {
  return {
    awaiting_withdrawal: atwAwaitingWithdrawal(atw),
    draft_slips: slips.filter((row) => row.status === "draft"),
  };
}
