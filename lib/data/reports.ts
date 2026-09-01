import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/data/queries";
import {
  ATW_REPORT_STATUSES,
  INVOICE_REPORT_STATUSES,
  SO_REPORT_STATUSES,
  WS_REPORT_STATUSES,
  ilikeContains,
  scopedRows,
  statusAppliesTo,
  type ReportFilters,
} from "@/lib/reports/filters";
import {
  computeInvoiceRemaining,
  computeSoRemaining,
  type PipelineAtw,
  type PipelineInvoice,
  type PipelineOrder,
  type PipelineSlip,
} from "@/lib/reports/pipeline";
import type { AtwStatus, InvoiceStatus, SoStatus, WsStatus } from "@/types/database";

type HeaderFilter = {
  gte: (column: string, value: string) => HeaderFilter;
  lte: (column: string, value: string) => HeaderFilter;
  eq: (column: string, value: string) => HeaderFilter;
  ilike: (column: string, value: string) => HeaderFilter;
};

type QueryResult = Promise<{ data: unknown[] | null; error: { message: string } | null }>;

function applyHeaderFilters(
  query: unknown,
  filters: ReportFilters,
  numberColumn: string,
  statuses: readonly string[],
): QueryResult {
  let next = query as HeaderFilter;
  if (filters.date_from) next = next.gte("order_date", filters.date_from);
  if (filters.date_to) next = next.lte("order_date", filters.date_to);
  if (filters.customer_id) next = next.eq("customer_id", filters.customer_id);
  if (filters.sales_employee_id) next = next.eq("sales_employee_id", filters.sales_employee_id);
  if (statusAppliesTo(filters, statuses) && filters.status !== "all") {
    next = next.eq("status", filters.status);
  }
  const pattern = ilikeContains(filters.number);
  if (pattern) next = next.ilike(numberColumn, pattern);
  return next as unknown as QueryResult;
}

export type OperationsSnapshot = {
  customers: number;
  orders: PipelineOrder[];
  invoices: PipelineInvoice[];
  atw: PipelineAtw[];
  slips: PipelineSlip[];
};

export async function loadOperationsSnapshot(
  filters: ReportFilters,
): Promise<OperationsSnapshot> {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    const ordersQuery = applyHeaderFilters(
      supabase
        .from("sales_orders")
        .select(
          "id, so_number, customer_id, customer_name, order_date, sales_employee_id, sales_employee_name, status, total_quantity, grand_total, sales_order_items(id, quantity), invoices(status, invoice_items(sales_order_item_id, quantity))",
        )
        .order("order_date", { ascending: false }),
      filters,
      "so_number",
      SO_REPORT_STATUSES,
    );
    const invoicesQuery = applyHeaderFilters(
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, sales_order_id, customer_id, customer_name, order_date, sales_employee_id, sales_employee_name, status, total_quantity, grand_total, invoice_items(id, quantity), atw_documents(status, atw_document_items(invoice_item_id, quantity))",
        )
        .order("order_date", { ascending: false }),
      filters,
      "invoice_number",
      INVOICE_REPORT_STATUSES,
    );
    const atwQuery = applyHeaderFilters(
      supabase
        .from("atw_documents")
        .select(
          "id, atw_number, document_type, invoice_id, customer_id, customer_name, order_date, sales_employee_id, sales_employee_name, status, total_quantity, grand_total, withdrawal_slips(id, status)",
        )
        .order("order_date", { ascending: false }),
      filters,
      "atw_number",
      ATW_REPORT_STATUSES,
    );
    const slipsQuery = applyHeaderFilters(
      supabase
        .from("withdrawal_slips")
        .select(
          "id, ws_number, atw_id, customer_id, customer_name, order_date, sales_employee_id, sales_employee_name, status, total_quantity, grand_total",
        )
        .order("order_date", { ascending: false }),
      filters,
      "ws_number",
      WS_REPORT_STATUSES,
    );

    const [customers, ordersRes, invoicesRes, atwRes, slipsRes] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }),
      ordersQuery,
      invoicesQuery,
      atwQuery,
      slipsQuery,
    ]);

    if (ordersRes.error) throw ordersRes.error;
    if (invoicesRes.error) throw invoicesRes.error;
    if (atwRes.error) throw atwRes.error;
    if (slipsRes.error) throw slipsRes.error;

    const orders = ((ordersRes.data ?? []) as {
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
      sales_order_items?: { id: string; quantity: number }[] | null;
      invoices?: {
        status: InvoiceStatus;
        invoice_items?: { sales_order_item_id: string; quantity: number }[] | null;
      }[] | null;
    }[]).map((row) => {
      const lines = (row.sales_order_items ?? []).map((line) => ({
        id: line.id,
        quantity: Number(line.quantity),
      }));
      const invoiceLines = (row.invoices ?? []).flatMap((invoice) =>
        (invoice.invoice_items ?? []).map((item) => ({
          sales_order_item_id: item.sales_order_item_id,
          quantity: Number(item.quantity),
          invoice_status: invoice.status,
        })),
      );
      return {
        id: row.id,
        so_number: row.so_number,
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        order_date: row.order_date,
        sales_employee_id: row.sales_employee_id,
        sales_employee_name: row.sales_employee_name,
        status: row.status,
        total_quantity: Number(row.total_quantity),
        grand_total: Number(row.grand_total),
        remaining_qty: computeSoRemaining(lines, invoiceLines),
      };
    });

    const invoices = ((invoicesRes.data ?? []) as {
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
      invoice_items?: { id: string; quantity: number }[] | null;
      atw_documents?: {
        status: AtwStatus;
        atw_document_items?: { invoice_item_id: string; quantity: number }[] | null;
      }[] | null;
    }[]).map((row) => {
      const lines = (row.invoice_items ?? []).map((line) => ({
        id: line.id,
        quantity: Number(line.quantity),
      }));
      const atwLines = (row.atw_documents ?? []).flatMap((doc) =>
        (doc.atw_document_items ?? []).map((item) => ({
          invoice_item_id: item.invoice_item_id,
          quantity: Number(item.quantity),
          atw_status: doc.status,
        })),
      );
      return {
        id: row.id,
        invoice_number: row.invoice_number,
        sales_order_id: row.sales_order_id,
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        order_date: row.order_date,
        sales_employee_id: row.sales_employee_id,
        sales_employee_name: row.sales_employee_name,
        status: row.status,
        total_quantity: Number(row.total_quantity),
        grand_total: Number(row.grand_total),
        remaining_qty: computeInvoiceRemaining(lines, atwLines),
      };
    });

    const atw = ((atwRes.data ?? []) as {
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
      withdrawal_slips?: { id: string; status: WsStatus }[] | null;
    }[]).map((row) => {
      const active = (row.withdrawal_slips ?? []).find((slip) => slip.status !== "cancelled");
      return {
        id: row.id,
        atw_number: row.atw_number,
        document_type: row.document_type,
        invoice_id: row.invoice_id,
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        order_date: row.order_date,
        sales_employee_id: row.sales_employee_id,
        sales_employee_name: row.sales_employee_name,
        status: row.status,
        total_quantity: Number(row.total_quantity),
        grand_total: Number(row.grand_total),
        has_active_slip: Boolean(active),
        active_withdrawal_slip_id: active?.id ?? null,
      };
    });

    const slips = ((slipsRes.data ?? []) as PipelineSlip[]).map((row) => ({
      ...row,
      total_quantity: Number(row.total_quantity),
      grand_total: Number(row.grand_total),
    }));

    return {
      customers: customers.count ?? 0,
      orders: scopedRows(orders, filters, SO_REPORT_STATUSES),
      invoices: scopedRows(invoices, filters, INVOICE_REPORT_STATUSES),
      atw: scopedRows(atw, filters, ATW_REPORT_STATUSES),
      slips: scopedRows(slips, filters, WS_REPORT_STATUSES),
    };
  }, { customers: 0, orders: [], invoices: [], atw: [], slips: [] });
}
