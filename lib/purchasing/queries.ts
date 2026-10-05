import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  BillOfLadingItemRow,
  BillOfLadingRow,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  PurchasingEventRow,
  ReceivingDiscrepancyRow,
  ReceivingReportItemRow,
  ReceivingReportRow,
  SupplierRow,
} from "@/types/database";

async function client() {
  return createServerSupabaseClient();
}

export async function listSuppliers(q = "", status = "all") {
  const supabase = await client();
  let query = supabase.from("suppliers").select("*").order("name");
  if (status === "active" || status === "inactive") query = query.eq("status", status);
  if (q.trim()) {
    const pattern = `%${q.trim().replaceAll("%", "")}%`;
    query = query.or(`name.ilike.${pattern},supplier_code.ilike.${pattern},contact_person.ilike.${pattern}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierRow[];
}

export async function getSupplier(id: string) {
  const supabase = await client();
  const { data } = await supabase.from("suppliers").select("*").eq("id", id).maybeSingle();
  return (data as SupplierRow | null) ?? null;
}

export async function listPurchaseOrders(q = "", status = "all", from = "", to = "") {
  const supabase = await client();
  let query = supabase.from("purchase_orders").select("*").order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);
  if (from) query = query.gte("po_date", from);
  if (to) query = query.lte("po_date", to);
  if (q.trim()) {
    const pattern = `%${q.trim().replaceAll("%", "")}%`;
    query = query.or(`po_number.ilike.${pattern},supplier_name.ilike.${pattern},supplier_code.ilike.${pattern}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as PurchaseOrderRow[];
}

export async function getPurchaseOrder(id: string) {
  const supabase = await client();
  const { data } = await supabase
    .from("purchase_orders")
    .select("*, purchase_order_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const header = data as PurchaseOrderRow & { purchase_order_items?: PurchaseOrderItemRow[] };
  const { data: bols } = await supabase
    .from("bills_of_lading")
    .select("id, bol_number, shipment_date, status")
    .eq("purchase_order_id", id)
    .order("created_at");
  const { data: reports } = await supabase
    .from("receiving_reports")
    .select("id, rr_number, receiving_date, status, bill_of_lading_id")
    .eq("purchase_order_id", id)
    .order("created_at");
  const { data: events } = await supabase
    .from("purchasing_events")
    .select("*")
    .eq("document_type", "purchase_order")
    .eq("document_id", id)
    .order("created_at");
  return {
    ...header,
    purchase_order_items: [...(header.purchase_order_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    bills: bols ?? [],
    reports: reports ?? [],
    events: (events ?? []) as PurchasingEventRow[],
  };
}

export async function listBillsOfLading(q = "", from = "", to = "") {
  const supabase = await client();
  const { data, error } = await supabase
    .from("bills_of_lading")
    .select("*, purchase_orders(po_number, supplier_name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  let scoped = data;
  if (from || to) {
    scoped = (data ?? []).filter((row) => {
      const day = String((row as { shipment_date?: string }).shipment_date ?? "").slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }
  const rows = (scoped ?? []) as (BillOfLadingRow & {
    purchase_orders?: { po_number: string; supplier_name: string } | { po_number: string; supplier_name: string }[] | null;
  })[];
  const needle = q.trim().toLowerCase();
  return rows
    .map((row) => {
      const po = Array.isArray(row.purchase_orders) ? row.purchase_orders[0] : row.purchase_orders;
      return { ...row, po_number: po?.po_number ?? "", supplier_name: po?.supplier_name ?? "" };
    })
    .filter((row) => {
      if (!needle) return true;
      return [row.bol_number, row.po_number, row.supplier_name].join(" ").toLowerCase().includes(needle);
    });
}

export async function getBillOfLading(id: string) {
  const supabase = await client();
  const { data } = await supabase
    .from("bills_of_lading")
    .select("*, bill_of_lading_items(*), purchase_orders(id, po_number, supplier_id, supplier_name, supplier_code, status)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const header = data as BillOfLadingRow & {
    bill_of_lading_items?: BillOfLadingItemRow[];
    purchase_orders?: { id: string; po_number: string; supplier_id: string; supplier_name: string; supplier_code: string; status: string } | null;
  };
  const { data: reports } = await supabase
    .from("receiving_reports")
    .select("id, rr_number, receiving_date, status")
    .eq("bill_of_lading_id", id)
    .order("created_at");
  const { data: events } = await supabase
    .from("purchasing_events")
    .select("*")
    .eq("document_type", "bill_of_lading")
    .eq("document_id", id)
    .order("created_at");
  return {
    ...header,
    bill_of_lading_items: [...(header.bill_of_lading_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    reports: reports ?? [],
    events: (events ?? []) as PurchasingEventRow[],
  };
}

export async function listReceivingReports(q = "", from = "", to = "") {
  const supabase = await client();
  const { data, error } = await supabase
    .from("receiving_reports")
    .select("*, bills_of_lading(bol_number), purchase_orders(po_number, supplier_name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as (ReceivingReportRow & {
    bills_of_lading?: { bol_number: string } | null;
    purchase_orders?: { po_number: string; supplier_name: string } | null;
  })[];
  const needle = q.trim().toLowerCase();
  return rows
    .map((row) => ({
      ...row,
      bol_number: row.bills_of_lading?.bol_number ?? "",
      po_number: row.purchase_orders?.po_number ?? "",
      supplier_name: row.purchase_orders?.supplier_name ?? "",
    }))
    .filter((row) => {
      const day = String(row.receiving_date ?? "").slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!needle) return true;
      return [row.rr_number, row.bol_number, row.po_number, row.supplier_name].join(" ").toLowerCase().includes(needle);
    });
}

export async function listWorkbenchPurchaseOrders() {
  try {
    const rows = await listPurchaseOrders();
    return rows
      .filter((row) => ["for_approval", "approved", "partially_shipped", "fully_shipped", "partially_received"].includes(row.status))
      .slice(0, 25);
  } catch {
    return [];
  }
}

export async function purchasingIndicators() {
  const empty = { awaiting: 0, openPo: 0, inTransit: 0, openShort: 0 };
  try {
    const supabase = await client();
    const { data: orders, error } = await supabase.from("purchase_orders").select("status");
    if (error || !orders) return empty;
    const { data: bols } = await supabase.from("bills_of_lading").select("status");
    const { count } = await supabase
      .from("receiving_discrepancies")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .eq("discrepancy_type", "short");
    const openStatuses = new Set(["approved", "partially_shipped", "fully_shipped", "partially_received", "for_approval"]);
    return {
      awaiting: orders.filter((row) => row.status === "for_approval").length,
      openPo: orders.filter((row) => openStatuses.has(String(row.status)) && row.status !== "for_approval").length,
      inTransit: (bols ?? []).filter((row) => ["posted", "in_transit", "arrived", "partially_received"].includes(String(row.status))).length,
      openShort: count ?? 0,
    };
  } catch {
    return empty;
  }
}

export async function listRecentReceiptMovements() {
  try {
    const supabase = await client();
    const { data, error } = await supabase
      .from("inventory_movements")
      .select("id, item_id, quantity, source_id, reverses_movement_id, occurred_at")
      .eq("source_type", "receiving_report")
      .order("occurred_at", { ascending: false })
      .limit(8);
    if (error || !data?.length) return [];
    const reportIds = [...new Set(data.map((row) => String(row.source_id)))];
    const itemIds = [...new Set(data.map((row) => String(row.item_id)))];
    const { data: reports } = await supabase.from("receiving_reports").select("id, rr_number").in("id", reportIds);
    const { data: items } = await supabase.from("items").select("id, name").in("id", itemIds);
    const reportName = new Map((reports ?? []).map((row) => [row.id, row.rr_number]));
    const itemName = new Map((items ?? []).map((row) => [row.id, row.name]));
    return data.map((row) => ({
      id: String(row.id),
      quantity: Number(row.quantity),
      reversal: Boolean(row.reverses_movement_id),
      rrId: String(row.source_id),
      rrNumber: reportName.get(String(row.source_id)) ?? "Receiving report",
      itemName: itemName.get(String(row.item_id)) ?? "Item",
      occurredAt: String(row.occurred_at),
    }));
  } catch {
    return [];
  }
}

export async function getReceivingReport(id: string) {
  const supabase = await client();
  const { data } = await supabase
    .from("receiving_reports")
    .select("*, receiving_report_items(*), bills_of_lading(id, bol_number), purchase_orders(id, po_number, supplier_id, supplier_name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const header = data as ReceivingReportRow & {
    receiving_report_items?: ReceivingReportItemRow[];
    bills_of_lading?: { id: string; bol_number: string } | null;
    purchase_orders?: { id: string; po_number: string; supplier_id: string; supplier_name: string } | null;
  };
  const itemIds = (header.receiving_report_items ?? []).map((line) => line.id);
  const { data: discrepancies } = itemIds.length
    ? await supabase.from("receiving_discrepancies").select("*").in("receiving_report_item_id", itemIds)
    : { data: [] };
  const { data: movements } = await supabase
    .from("inventory_movements")
    .select("id, item_id, quantity, reverses_movement_id")
    .eq("source_type", "receiving_report")
    .eq("source_id", id);
  const { data: events } = await supabase
    .from("purchasing_events")
    .select("*")
    .eq("document_type", "receiving_report")
    .eq("document_id", id)
    .order("created_at");
  return {
    ...header,
    receiving_report_items: [...(header.receiving_report_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    discrepancies: (discrepancies ?? []) as ReceivingDiscrepancyRow[],
    movements: movements ?? [],
    events: (events ?? []) as PurchasingEventRow[],
  };
}
