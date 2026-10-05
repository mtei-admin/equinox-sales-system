export type {
  AtwDocumentItemRow,
  AtwDocumentType,
  AtwRow,
  AtwStatus,
  BillOfLadingItemRow,
  BillOfLadingRow,
  BolStatus,
  CustomerRow,
  DiscrepancyStatus,
  DiscrepancyType,
  PoStatus,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  PurchasingEventRow,
  ReceivingDiscrepancyRow,
  ReceivingReportItemRow,
  ReceivingReportRow,
  RrStatus,
  ShipmentMode,
  SupplierRow,
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
  | "suppliers"
  | "items"
  | "purchase-orders"
  | "bills-of-lading"
  | "receiving-reports"
  | "users"
  | "sales-orders"
  | "invoices"
  | "atw-dr"
  | "withdrawal-slips"
  | "inventory"
  | "reports";
