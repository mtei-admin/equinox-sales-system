export type {
  AtwDocumentItemRow,
  AtwDocumentType,
  AtwRow,
  AtwStatus,
  CustomerRow,
  InvoiceItemRow,
  InvoiceRow,
  InvoiceStatus,
  InventoryAdjustmentDirection,
  InventoryAdjustmentItemRow,
  InventoryAdjustmentRow,
  InventoryAdjustmentStatus,
  InventoryStockRow,
  ItemRow,
  MasterStatus,
  SalesOrderItemRow,
  SalesOrderRow,
  SoStatus,
  UserRole,
  UserRow,
  WarehouseRow,
  WithdrawalSlipItemRow,
  WithdrawalSlipRow,
  WsStatus,
} from "./database";

export type DocumentKind = "customer" | "sales_order" | "invoice" | "atw_dr" | "withdrawal_slip";

export type ModuleKey =
  | "dashboard"
  | "customers"
  | "items"
  | "users"
  | "sales-orders"
  | "invoices"
  | "atw-dr"
  | "withdrawal-slips"
  | "inventory"
  | "reports";
