export type UserRole = "admin" | "sales" | "warehouse" | "accounting";
export type MasterStatus = "active" | "inactive";
export type SoStatus = "draft" | "open" | "closed" | "cancelled";
export type InvoiceStatus = "draft" | "posted" | "cancelled";
export type AtwStatus = "draft" | "released" | "cancelled";
export type WsStatus = "draft" | "issued" | "cancelled";
export type AtwDocumentType = "atw" | "dr";

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
