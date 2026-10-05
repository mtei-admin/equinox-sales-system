export type UserRole = "admin" | "sales" | "warehouse" | "accounting";
export type MasterStatus = "active" | "inactive";
export type SoStatus = "draft" | "open" | "closed" | "cancelled";
export type InvoiceStatus = "draft" | "posted" | "cancelled";
export type AtwStatus = "draft" | "released" | "cancelled";
export type WsStatus = "draft" | "issued" | "cancelled";
export type AtwDocumentType = "atw" | "dr";
export type InventoryAdjustmentStatus = "draft" | "posted" | "cancelled";
export type InventoryAdjustmentDirection = "increase" | "decrease";
export type InventoryMovementSource = "adjustment" | "withdrawal_slip" | "receiving_report";
export type PoStatus =
  | "draft"
  | "for_approval"
  | "approved"
  | "partially_shipped"
  | "fully_shipped"
  | "partially_received"
  | "completed"
  | "closed"
  | "cancelled";
export type BolStatus =
  | "draft"
  | "posted"
  | "in_transit"
  | "arrived"
  | "partially_received"
  | "fully_received"
  | "cancelled";
export type RrStatus = "draft" | "posted" | "cancelled";
export type ShipmentMode = "sea" | "land";
export type DiscrepancyType = "short" | "damaged" | "excess";
export type DiscrepancyStatus =
  | "open"
  | "accepted"
  | "for_claim"
  | "replacement_expected"
  | "rejected"
  | "resolved";

export type UserRow = {
  id: string;
  username: string;
  full_name: string;
  department: string | null;
  role: UserRole;
  status: MasterStatus;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type CustomerRow = {
  id: string;
  name: string;
  billing_address: string | null;
  tin_number: string | null;
  status: MasterStatus;
  contact_person: string | null;
  contact_number: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type ItemRow = {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  serial_no: string | null;
  barcode: string | null;
  status: MasterStatus;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type SalesOrderRow = {
  id: string;
  so_number: string;
  customer_id: string;
  customer_name: string;
  delivery_address: string | null;
  order_date: string;
  term: string | null;
  reference_no: string | null;
  order_type: string | null;
  sales_employee_id: string | null;
  sales_employee_name: string | null;
  warehouse_id: string;
  total_quantity: number;
  grand_total: number;
  status: SoStatus;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export type SalesOrderItemRow = {
  id: string;
  sales_order_id: string;
  item_id: string;
  model: string | null;
  serial_no: string | null;
  barcode: string | null;
  description: string | null;
  quantity: number;
  uom: string;
  unit_price: number;
  amount: number;
  total_amount: number;
  sort_order: number;
};

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  sales_order_id: string;
  customer_id: string;
  customer_name: string;
  delivery_address: string | null;
  order_date: string;
  term: string | null;
  reference_no: string | null;
  order_type: string | null;
  sales_employee_id: string | null;
  sales_employee_name: string | null;
  warehouse_id: string;
  status: InvoiceStatus;
  remarks: string | null;
  total_quantity: number;
  grand_total: number;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  sales_order_item_id: string;
  item_id: string;
  model: string | null;
  serial_no: string | null;
  barcode: string | null;
  description: string | null;
  quantity: number;
  uom: string;
  unit_price: number;
  tax_amount: number;
  amount: number;
  total_amount: number;
  sort_order: number;
};

export type AtwRow = {
  id: string;
  atw_number: string;
  document_type: AtwDocumentType;
  invoice_id: string;
  sales_order_id: string;
  customer_id: string;
  customer_name: string;
  delivery_address: string | null;
  order_date: string;
  term: string | null;
  reference_no: string | null;
  order_type: string | null;
  sales_employee_id: string | null;
  sales_employee_name: string | null;
  warehouse_id: string;
  status: AtwStatus;
  remarks: string | null;
  total_quantity: number;
  grand_total: number;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export type AtwDocumentItemRow = {
  id: string;
  atw_id: string;
  invoice_item_id: string;
  sales_order_item_id: string;
  item_id: string;
  model: string | null;
  serial_no: string | null;
  barcode: string | null;
  description: string | null;
  invoice_item_quantity: number;
  quantity: number;
  uom: string;
  unit_price: number;
  amount: number;
  total_amount: number;
  sort_order: number;
};

export type WithdrawalSlipRow = {
  id: string;
  ws_number: string;
  atw_id: string;
  invoice_id: string;
  sales_order_id: string;
  customer_id: string;
  customer_name: string;
  delivery_address: string | null;
  order_date: string;
  term: string | null;
  reference_no: string | null;
  order_type: string | null;
  sales_employee_id: string | null;
  sales_employee_name: string | null;
  warehouse_id: string;
  status: WsStatus;
  remarks: string | null;
  total_quantity: number;
  grand_total: number;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export type WithdrawalSlipItemRow = {
  id: string;
  withdrawal_slip_id: string;
  atw_item_id: string;
  invoice_item_id: string;
  sales_order_item_id: string;
  item_id: string;
  model: string | null;
  serial_no: string | null;
  barcode: string | null;
  description: string | null;
  quantity: number;
  uom: string;
  amount: number;
  total_amount: number;
  sort_order: number;
};

export type WarehouseRow = {
  id: string;
  name: string;
  status: MasterStatus;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type InventoryAdjustmentRow = {
  id: string;
  adj_number: string;
  warehouse_id: string;
  reason: string | null;
  remarks: string | null;
  status: InventoryAdjustmentStatus;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export type InventoryAdjustmentItemRow = {
  id: string;
  adjustment_id: string;
  item_id: string;
  item_name: string;
  description: string | null;
  model: string | null;
  barcode: string | null;
  quantity: number;
  direction: InventoryAdjustmentDirection;
  sort_order: number;
};

export type SupplierRow = {
  id: string;
  supplier_code: string;
  name: string;
  address: string | null;
  contact_person: string | null;
  contact_number: string | null;
  email: string | null;
  tin_number: string | null;
  payment_terms: string | null;
  remarks: string | null;
  status: MasterStatus;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type PurchaseOrderRow = {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  warehouse_id: string;
  po_date: string;
  expected_delivery_date: string | null;
  destination: string | null;
  payment_terms: string | null;
  supplier_reference: string | null;
  remarks: string | null;
  status: PoStatus;
  total_quantity: number;
  grand_total: number;
  approved_by: string | null;
  approved_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export type PurchaseOrderItemRow = {
  id: string;
  purchase_order_id: string;
  item_id: string;
  item_name: string;
  model: string | null;
  barcode: string | null;
  uom: string;
  ordered_qty: number;
  unit_cost: number;
  amount: number;
  shipped_qty: number;
  received_qty: number;
  sort_order: number;
};

export type BillOfLadingRow = {
  id: string;
  bol_number: string;
  purchase_order_id: string;
  shipment_mode: ShipmentMode;
  shipment_date: string;
  expected_arrival_date: string | null;
  carrier: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  container_number: string | null;
  seal_number: string | null;
  vehicle_plate_number: string | null;
  origin: string | null;
  destination: string | null;
  reference_number: string | null;
  remarks: string | null;
  status: BolStatus;
  posted_by: string | null;
  posted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export type BillOfLadingItemRow = {
  id: string;
  bill_of_lading_id: string;
  purchase_order_item_id: string;
  item_id: string;
  item_name: string;
  model: string | null;
  barcode: string | null;
  uom: string;
  shipped_qty: number;
  received_qty: number;
  sort_order: number;
};

export type ReceivingReportRow = {
  id: string;
  rr_number: string;
  bill_of_lading_id: string;
  purchase_order_id: string;
  warehouse_id: string;
  receiving_date: string;
  delivery_receipt_number: string | null;
  supplier_invoice_number: string | null;
  received_by: string | null;
  received_by_name: string | null;
  checked_by: string | null;
  checked_by_name: string | null;
  remarks: string | null;
  gross_weight: number | null;
  tare_weight: number | null;
  net_weight: number | null;
  weighbridge_ticket: string | null;
  status: RrStatus;
  posted_by: string | null;
  posted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export type ReceivingReportItemRow = {
  id: string;
  receiving_report_id: string;
  bol_item_id: string;
  purchase_order_item_id: string;
  item_id: string;
  item_name: string;
  uom: string;
  shipped_qty: number;
  previously_received_qty: number;
  actual_received_qty: number;
  good_qty: number;
  damaged_qty: number;
  short_qty: number;
  excess_qty: number;
  record_short: boolean;
  accept_excess: boolean;
  remarks: string | null;
  sort_order: number;
};

export type ReceivingDiscrepancyRow = {
  id: string;
  receiving_report_item_id: string;
  discrepancy_type: DiscrepancyType;
  quantity: number;
  status: DiscrepancyStatus;
  remarks: string | null;
  resolution_remarks: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
};

export type PurchasingEventRow = {
  id: string;
  document_type: string;
  document_id: string;
  reference_number: string | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
};

export type InventoryStockRow = {
  warehouse_id: string;
  warehouse_name: string;
  item_id: string;
  item_name: string;
  brand: string | null;
  model: string | null;
  barcode: string | null;
  item_status: MasterStatus;
  on_hand: number;
  reserved: number;
  available: number;
};
