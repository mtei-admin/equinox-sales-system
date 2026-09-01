import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  AtwDocumentItemRow,
  AtwRow,
  AtwStatus,
  CustomerRow,
  InvoiceItemRow,
  InvoiceRow,
  InvoiceStatus,
  ItemRow,
  SalesOrderItemRow,
  SalesOrderRow,
  UserRow,
  WithdrawalSlipItemRow,
  WithdrawalSlipRow,
  WsStatus,
} from "@/types/database";
import { ilikeContains, orIlike, type MasterListFilters, type UserListFilters } from "@/lib/master-data/filters";
import { allocateSoLines, soHeaderRemaining, type InvoiceQtyConsumption } from "@/lib/sales-orders/allocation";
import {
  allocateInvoiceLines,
  invoiceHeaderRemaining,
  type AtwQtyConsumption,
} from "@/lib/atw/allocation";
import { salesOrderSearchOr, type SalesOrderListFilters } from "@/lib/sales-orders/filters";
import { invoiceSearchOr, type InvoiceListFilters } from "@/lib/invoices/filters";
import { atwSearchOr, type AtwListFilters } from "@/lib/atw/filters";
import {
  atwLookupOr,
  withdrawalSlipSearchOr,
  type WithdrawalSlipListFilters,
} from "@/lib/withdrawal-slips/filters";

export async function safeQuery<T>(run: () => Promise<T>, fallback: NoInfer<T>): Promise<T> {
  if (!isSupabaseConfigured()) return fallback;
  try {
    return await run();
  } catch {
    return fallback;
  }
}

export type AuditLabels = {
  created_by_name: string | null;
  updated_by_name: string | null;
  cancelled_by_name: string | null;
};

async function resolveAuditNames(
  createdBy: string | null,
  updatedBy: string | null,
  cancelledBy: string | null = null,
): Promise<AuditLabels> {
  const ids = [createdBy, updatedBy, cancelledBy].filter((id): id is string => Boolean(id));
  if (ids.length === 0) return { created_by_name: null, updated_by_name: null, cancelled_by_name: null };
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("users").select("id, full_name, username").in("id", ids);
  const labels = new Map((data ?? []).map((row) => [row.id as string, (row.full_name || row.username) as string]));
  return {
    created_by_name: createdBy ? labels.get(createdBy) ?? null : null,
    updated_by_name: updatedBy ? labels.get(updatedBy) ?? null : null,
    cancelled_by_name: cancelledBy ? labels.get(cancelledBy) ?? null : null,
  };
}

export async function listCustomers(filters: MasterListFilters = { q: "", status: "all" }) {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from("customers").select("*").order("name");
    if (filters.status !== "all") query = query.eq("status", filters.status);
    const pattern = ilikeContains(filters.q);
    if (pattern) {
      query = query.or(
        orIlike(["name", "contact_person", "contact_number", "tin_number", "billing_address"], pattern),
      );
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as CustomerRow[];
  }, [] as CustomerRow[]);
}

export async function getCustomer(id: string) {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const row = data as CustomerRow;
    const audit = await resolveAuditNames(row.created_by, row.updated_by);
    return { ...row, ...audit };
  }, null);
}

export async function listItems(filters: MasterListFilters = { q: "", status: "all" }) {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from("items").select("*").order("name");
    if (filters.status !== "all") query = query.eq("status", filters.status);
    const pattern = ilikeContains(filters.q);
    if (pattern) {
      query = query.or(orIlike(["name", "brand", "model", "barcode", "serial_no", "description"], pattern));
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ItemRow[];
  }, [] as ItemRow[]);
}

export async function getItem(id: string) {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from("items").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const row = data as ItemRow;
    const audit = await resolveAuditNames(row.created_by, row.updated_by);
    return { ...row, ...audit };
  }, null);
}

export async function listSalesOrders(filters: SalesOrderListFilters = { q: "", status: "all" }) {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from("sales_orders").select("*").order("created_at", { ascending: false });
    if (filters.status !== "all") query = query.eq("status", filters.status);
    const pattern = ilikeContains(filters.q);
    if (pattern) query = query.or(salesOrderSearchOr(pattern));
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as SalesOrderRow[];
  }, [] as SalesOrderRow[]);
}

export type SalesOrderItemView = SalesOrderItemRow & {
  invoiced_qty: number;
  remaining_qty: number;
};

export type SalesOrderDetail = SalesOrderRow &
  AuditLabels & {
    sales_order_items: SalesOrderItemView[];
    remaining_qty: number;
  };

export async function getSalesOrder(id: string): Promise<SalesOrderDetail | null> {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("sales_orders")
      .select("*, sales_order_items(*), invoices(id, status, invoice_items(sales_order_item_id, quantity))")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const header = data as SalesOrderRow & {
      sales_order_items?: SalesOrderItemRow[] | null;
      invoices?: {
        id: string;
        status: InvoiceStatus;
        invoice_items?: { sales_order_item_id: string; quantity: number }[] | null;
      }[] | null;
    };
    const lines = [...(header.sales_order_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const invoiceLines: InvoiceQtyConsumption[] = (header.invoices ?? []).flatMap((invoice) =>
      (invoice.invoice_items ?? []).map((item) => ({
        sales_order_item_id: item.sales_order_item_id,
        quantity: Number(item.quantity),
        invoice_status: invoice.status,
      })),
    );
    const allocated = allocateSoLines(
      lines.map((line) => ({ id: line.id, quantity: Number(line.quantity) })),
      invoiceLines,
    );
    const remainingById = new Map(allocated.map((row) => [row.sales_order_item_id, row]));
    const audit = await resolveAuditNames(header.created_by, header.updated_by, header.cancelled_by);
    return {
      ...header,
      ...audit,
      remaining_qty: soHeaderRemaining(
        lines.map((line) => ({ id: line.id, quantity: Number(line.quantity) })),
        invoiceLines,
      ),
      sales_order_items: lines.map((line) => {
        const alloc = remainingById.get(line.id);
        return {
          ...line,
          quantity: Number(line.quantity),
          unit_price: Number(line.unit_price),
          amount: Number(line.amount),
          total_amount: Number(line.total_amount),
          invoiced_qty: alloc?.invoiced ?? 0,
          remaining_qty: alloc?.remaining ?? Number(line.quantity),
        };
      }),
    };
  }, null);
}

export async function listActiveUsers() {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, username, role, status")
      .eq("status", "active")
      .order("full_name");
    if (error) throw error;
    return (data ?? []) as Pick<UserRow, "id" | "full_name" | "username" | "role" | "status">[];
  }, [] as Pick<UserRow, "id" | "full_name" | "username" | "role" | "status">[]);
}

export async function listInvoices(filters: InvoiceListFilters = { q: "", status: "all" }) {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("invoices")
      .select("*, sales_orders(so_number)")
      .order("created_at", { ascending: false });
    if (filters.status !== "all") query = query.eq("status", filters.status);
    const pattern = ilikeContains(filters.q);
    if (pattern) query = query.or(invoiceSearchOr(pattern));
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => {
      const invoice = row as InvoiceRow & { sales_orders?: { so_number: string } | { so_number: string }[] | null };
      const so = Array.isArray(invoice.sales_orders) ? invoice.sales_orders[0] : invoice.sales_orders;
      return { ...invoice, so_number: so?.so_number ?? "" };
    }) as (InvoiceRow & { so_number: string })[];
  }, [] as (InvoiceRow & { so_number: string })[]);
}

export type InvoiceItemView = InvoiceItemRow & {
  atw_qty: number;
  remaining_qty: number;
};

export type InvoiceDetail = InvoiceRow &
  AuditLabels & {
    so_number: string;
    remaining_qty: number;
    invoice_items: InvoiceItemView[];
  };

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("invoices")
      .select(
        "*, invoice_items(*), sales_orders(so_number), atw_documents(id, status, atw_document_items(invoice_item_id, quantity))",
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const header = data as InvoiceRow & {
      invoice_items?: InvoiceItemRow[] | null;
      sales_orders?: { so_number: string } | { so_number: string }[] | null;
      atw_documents?: {
        id: string;
        status: AtwStatus;
        atw_document_items?: { invoice_item_id: string; quantity: number }[] | null;
      }[] | null;
    };
    const so = Array.isArray(header.sales_orders) ? header.sales_orders[0] : header.sales_orders;
    const audit = await resolveAuditNames(header.created_by, header.updated_by, header.cancelled_by);
    const lines = [...(header.invoice_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const atwLines: AtwQtyConsumption[] = (header.atw_documents ?? []).flatMap((doc) =>
      (doc.atw_document_items ?? []).map((item) => ({
        invoice_item_id: item.invoice_item_id,
        quantity: Number(item.quantity),
        atw_status: doc.status,
      })),
    );
    const invoiceLines = lines.map((line) => ({ id: line.id, quantity: Number(line.quantity) }));
    const allocated = allocateInvoiceLines(invoiceLines, atwLines);
    const remainingById = new Map(allocated.map((row) => [row.invoice_item_id, row]));
    return {
      ...header,
      ...audit,
      so_number: so?.so_number ?? "",
      remaining_qty: invoiceHeaderRemaining(invoiceLines, atwLines),
      invoice_items: lines.map((line) => {
        const alloc = remainingById.get(line.id);
        return {
          ...line,
          quantity: Number(line.quantity),
          unit_price: Number(line.unit_price),
          tax_amount: Number(line.tax_amount),
          amount: Number(line.amount),
          total_amount: Number(line.total_amount),
          atw_qty: alloc?.allocated ?? 0,
          remaining_qty: alloc?.remaining ?? Number(line.quantity),
        };
      }),
    };
  }, null);
}

export async function listAtw(filters: AtwListFilters = { q: "", status: "all", document_type: "all" }) {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("atw_documents")
      .select("*, invoices(invoice_number)")
      .order("created_at", { ascending: false });
    if (filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.document_type !== "all") query = query.eq("document_type", filters.document_type);
    const pattern = ilikeContains(filters.q);
    if (pattern) query = query.or(atwSearchOr(pattern));
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => {
      const doc = row as AtwRow & { invoices?: { invoice_number: string } | { invoice_number: string }[] | null };
      const invoice = Array.isArray(doc.invoices) ? doc.invoices[0] : doc.invoices;
      return { ...doc, invoice_number: invoice?.invoice_number ?? "" };
    }) as (AtwRow & { invoice_number: string })[];
  }, [] as (AtwRow & { invoice_number: string })[]);
}

export type AtwDetail = AtwRow &
  AuditLabels & {
    invoice_number: string;
    so_number: string;
    atw_document_items: AtwDocumentItemRow[];
    active_withdrawal_slip_id: string | null;
  };

export async function getAtw(id: string): Promise<AtwDetail | null> {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("atw_documents")
      .select(
        "*, atw_document_items(*), invoices(invoice_number), sales_orders(so_number), withdrawal_slips(id, status)",
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const header = data as AtwRow & {
      atw_document_items?: AtwDocumentItemRow[] | null;
      invoices?: { invoice_number: string } | { invoice_number: string }[] | null;
      sales_orders?: { so_number: string } | { so_number: string }[] | null;
      withdrawal_slips?: { id: string; status: WsStatus }[] | null;
    };
    const invoice = Array.isArray(header.invoices) ? header.invoices[0] : header.invoices;
    const so = Array.isArray(header.sales_orders) ? header.sales_orders[0] : header.sales_orders;
    const audit = await resolveAuditNames(header.created_by, header.updated_by, header.cancelled_by);
    const lines = [...(header.atw_document_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const activeSlip = (header.withdrawal_slips ?? []).find((slip) => slip.status !== "cancelled");
    return {
      ...header,
      ...audit,
      invoice_number: invoice?.invoice_number ?? "",
      so_number: so?.so_number ?? "",
      active_withdrawal_slip_id: activeSlip?.id ?? null,
      atw_document_items: lines.map((line) => ({
        ...line,
        invoice_item_quantity: Number(line.invoice_item_quantity),
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
        amount: Number(line.amount),
        total_amount: Number(line.total_amount),
      })),
    };
  }, null);
}

export type ReleasedAtwMatch = Pick<
  AtwRow,
  "id" | "atw_number" | "document_type" | "customer_name" | "status" | "total_quantity"
> & {
  has_active_slip: boolean;
  active_withdrawal_slip_id: string | null;
};

export async function searchReleasedAtw(q: string): Promise<ReleasedAtwMatch[]> {
  return safeQuery(async () => {
    const or = atwLookupOr(q);
    if (!or) return [];
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("atw_documents")
      .select("id, atw_number, document_type, customer_name, status, total_quantity, withdrawal_slips(id, status)")
      .eq("status", "released")
      .or(or)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw error;
    return (data ?? []).map((row) => {
      const doc = row as ReleasedAtwMatch & {
        withdrawal_slips?: { id: string; status: WsStatus }[] | null;
      };
      const active = (doc.withdrawal_slips ?? []).find((slip) => slip.status !== "cancelled");
      return {
        id: doc.id,
        atw_number: doc.atw_number,
        document_type: doc.document_type,
        customer_name: doc.customer_name,
        status: doc.status,
        total_quantity: Number(doc.total_quantity),
        has_active_slip: Boolean(active),
        active_withdrawal_slip_id: active?.id ?? null,
      };
    });
  }, [] as ReleasedAtwMatch[]);
}

export async function listWithdrawalSlips(
  filters: WithdrawalSlipListFilters = { q: "", status: "all" },
) {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("withdrawal_slips")
      .select("*, atw_documents(atw_number, document_type)")
      .order("created_at", { ascending: false });
    if (filters.status !== "all") query = query.eq("status", filters.status);
    const pattern = ilikeContains(filters.q);
    if (pattern) query = query.or(withdrawalSlipSearchOr(pattern));
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => {
      const slip = row as WithdrawalSlipRow & {
        atw_documents?: { atw_number: string; document_type: string } | { atw_number: string; document_type: string }[] | null;
      };
      const atw = Array.isArray(slip.atw_documents) ? slip.atw_documents[0] : slip.atw_documents;
      return {
        ...slip,
        atw_number: atw?.atw_number ?? "",
        document_type: atw?.document_type ?? "",
      };
    }) as (WithdrawalSlipRow & { atw_number: string; document_type: string })[];
  }, [] as (WithdrawalSlipRow & { atw_number: string; document_type: string })[]);
}

export type WithdrawalSlipDetail = WithdrawalSlipRow &
  AuditLabels & {
    atw_number: string;
    document_type: string;
    invoice_number: string;
    so_number: string;
    withdrawal_slip_items: WithdrawalSlipItemRow[];
  };

export async function getWithdrawalSlip(id: string): Promise<WithdrawalSlipDetail | null> {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("withdrawal_slips")
      .select(
        "*, withdrawal_slip_items(*), atw_documents(atw_number, document_type), invoices(invoice_number), sales_orders(so_number)",
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const header = data as WithdrawalSlipRow & {
      withdrawal_slip_items?: WithdrawalSlipItemRow[] | null;
      atw_documents?: { atw_number: string; document_type: string } | { atw_number: string; document_type: string }[] | null;
      invoices?: { invoice_number: string } | { invoice_number: string }[] | null;
      sales_orders?: { so_number: string } | { so_number: string }[] | null;
    };
    const atw = Array.isArray(header.atw_documents) ? header.atw_documents[0] : header.atw_documents;
    const invoice = Array.isArray(header.invoices) ? header.invoices[0] : header.invoices;
    const so = Array.isArray(header.sales_orders) ? header.sales_orders[0] : header.sales_orders;
    const audit = await resolveAuditNames(header.created_by, header.updated_by, header.cancelled_by);
    const lines = [...(header.withdrawal_slip_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    return {
      ...header,
      ...audit,
      atw_number: atw?.atw_number ?? "",
      document_type: atw?.document_type ?? "",
      invoice_number: invoice?.invoice_number ?? "",
      so_number: so?.so_number ?? "",
      withdrawal_slip_items: lines.map((line) => ({
        ...line,
        quantity: Number(line.quantity),
        amount: Number(line.amount),
        total_amount: Number(line.total_amount),
      })),
    };
  }, null);
}

export async function listProfiles(filters: UserListFilters = { q: "", status: "all", role: "all" }) {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from("users").select("*").order("full_name");
    if (filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.role !== "all") query = query.eq("role", filters.role);
    const pattern = ilikeContains(filters.q);
    if (pattern) {
      query = query.or(orIlike(["full_name", "username", "department"], pattern));
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as UserRow[];
  }, [] as UserRow[]);
}

export async function getProfile(id: string) {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const row = data as UserRow;
    const audit = await resolveAuditNames(row.created_by, row.updated_by);
    return { ...row, ...audit };
  }, null);
}

export async function dashboardCounts() {
  return safeQuery(async () => {
    const supabase = await createServerSupabaseClient();
    const [customers, orders, invoices, atw, slips] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase.from("sales_orders").select("id", { count: "exact", head: true }).neq("status", "cancelled"),
      supabase.from("invoices").select("id", { count: "exact", head: true }).neq("status", "cancelled"),
      supabase.from("atw_documents").select("id", { count: "exact", head: true }).neq("status", "cancelled"),
      supabase.from("withdrawal_slips").select("id", { count: "exact", head: true }).eq("status", "issued"),
    ]);
    return {
      customers: customers.count ?? 0,
      orders: orders.count ?? 0,
      invoices: invoices.count ?? 0,
      atw: atw.count ?? 0,
      slips: slips.count ?? 0,
      lowStock: [] as { id: string; name: string; sku: string; stock_qty: number; reorder_level: number }[],
    };
  }, { customers: 0, orders: 0, invoices: 0, atw: 0, slips: 0, lowStock: [] });
}
