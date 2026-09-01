export type {
  AtwDocumentItemRow,
  AtwDocumentType,
  AtwRow,
  AtwStatus,
  CustomerRow,
  InvoiceItemRow,
  InvoiceRow,
  InvoiceStatus,
  ItemRow,
  MasterStatus,
  SalesOrderItemRow,
  SalesOrderRow,
  SoStatus,
  UserRole,
  UserRow,
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
  | "reports";
