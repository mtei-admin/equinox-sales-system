import { formatDate, formatMoney, formatQty } from "@/lib/utils";
import type {
  AtwDocumentItemRow,
  AtwDocumentType,
  AtwRow,
  InvoiceItemRow,
  InvoiceRow,
  WithdrawalSlipItemRow,
  WithdrawalSlipRow,
} from "@/types/database";

export type PrintMeta = { label: string; value: string };

export type PrintLine = {
  id: string;
  title: string;
  detail: string;
  values: string[];
};

export type PrintDocument = {
  title: string;
  number: string;
  date: string;
  status: string;
  cancelled: boolean;
  cancellationReason: string | null;
  customerName: string;
  deliveryAddress: string;
  meta: PrintMeta[];
  columns: string[];
  lines: PrintLine[];
  totalQuantity: string;
  grandTotal: string;
  remarks: string | null;
  note: string | null;
  preparedBy: string | null;
};

type HeaderSource = {
  customer_name: string;
  delivery_address: string | null;
  order_date: string;
  term: string | null;
  reference_no: string | null;
  order_type: string | null;
  sales_employee_name: string | null;
  status: string;
  remarks: string | null;
  total_quantity: number;
  grand_total: number;
  cancellation_reason: string | null;
  created_by_name?: string | null;
};

function text(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function lineTitle(description: string | null, model: string | null) {
  return description?.trim() || model?.trim() || "Item";
}

function lineDetail(line: { model: string | null; serial_no: string | null; barcode: string | null }) {
  return [line.model, line.serial_no, line.barcode].filter((part) => part?.trim()).join(" · ");
}

function sharedMeta(header: HeaderSource, extras: PrintMeta[]): PrintMeta[] {
  return [
    ...extras,
    { label: "Term", value: text(header.term) },
    { label: "Reference", value: text(header.reference_no) },
    { label: "Order type", value: text(header.order_type) },
    { label: "Sales employee", value: text(header.sales_employee_name) },
  ];
}

function baseDocument(
  header: HeaderSource,
  extras: PrintMeta[],
  columns: string[],
  lines: PrintLine[],
  title: string,
  number: string,
  note: string | null,
): PrintDocument {
  return {
    title,
    number,
    date: formatDate(header.order_date),
    status: header.status,
    cancelled: header.status === "cancelled",
    cancellationReason: header.cancellation_reason?.trim() || null,
    customerName: header.customer_name,
    deliveryAddress: text(header.delivery_address),
    meta: sharedMeta(header, extras),
    columns,
    lines,
    totalQuantity: formatQty(header.total_quantity),
    grandTotal: formatMoney(header.grand_total),
    remarks: header.remarks?.trim() || null,
    note,
    preparedBy: header.created_by_name?.trim() || null,
  };
}

export type InvoicePrintSource = Pick<
  InvoiceRow,
  | "invoice_number"
  | "customer_name"
  | "delivery_address"
  | "order_date"
  | "term"
  | "reference_no"
  | "order_type"
  | "sales_employee_name"
  | "status"
  | "remarks"
  | "total_quantity"
  | "grand_total"
  | "cancellation_reason"
> & {
  so_number: string;
  created_by_name?: string | null;
  invoice_items: Pick<
    InvoiceItemRow,
    "id" | "description" | "model" | "serial_no" | "barcode" | "quantity" | "uom" | "unit_price" | "tax_amount" | "total_amount"
  >[];
};

export function invoicePrintDocument(invoice: InvoicePrintSource): PrintDocument {
  return baseDocument(
    invoice,
    [{ label: "Sales order", value: text(invoice.so_number) }],
    ["Item", "Qty", "Unit price", "Tax", "Amount"],
    invoice.invoice_items.map((line) => ({
      id: line.id,
      title: lineTitle(line.description, line.model),
      detail: lineDetail(line),
      values: [
        `${formatQty(line.quantity)} ${line.uom}`,
        formatMoney(line.unit_price),
        formatMoney(line.tax_amount),
        formatMoney(line.total_amount),
      ],
    })),
    "Invoice",
    invoice.invoice_number,
    "Copy of the invoice on file. The number is the pre-printed invoice number.",
  );
}

export type AtwPrintSource = Pick<
  AtwRow,
  | "atw_number"
  | "document_type"
  | "customer_name"
  | "delivery_address"
  | "order_date"
  | "term"
  | "reference_no"
  | "order_type"
  | "sales_employee_name"
  | "status"
  | "remarks"
  | "total_quantity"
  | "grand_total"
  | "cancellation_reason"
> & {
  invoice_number: string;
  so_number: string;
  created_by_name?: string | null;
  atw_document_items: Pick<
    AtwDocumentItemRow,
    "id" | "description" | "model" | "serial_no" | "barcode" | "quantity" | "uom" | "unit_price" | "total_amount"
  >[];
};

export function atwPrintTitle(documentType: AtwDocumentType) {
  return documentType === "dr" ? "Delivery Receipt" : "Authority To Withdraw";
}

export function atwPrintDocument(doc: AtwPrintSource): PrintDocument {
  return baseDocument(
    doc,
    [
      { label: "Invoice", value: text(doc.invoice_number) },
      { label: "Sales order", value: text(doc.so_number) },
    ],
    ["Item", "Qty", "Unit price", "Amount"],
    doc.atw_document_items.map((line) => ({
      id: line.id,
      title: lineTitle(line.description, line.model),
      detail: lineDetail(line),
      values: [`${formatQty(line.quantity)} ${line.uom}`, formatMoney(line.unit_price), formatMoney(line.total_amount)],
    })),
    atwPrintTitle(doc.document_type),
    doc.atw_number,
    null,
  );
}

export type WithdrawalSlipPrintSource = Pick<
  WithdrawalSlipRow,
  | "ws_number"
  | "customer_name"
  | "delivery_address"
  | "order_date"
  | "term"
  | "reference_no"
  | "order_type"
  | "sales_employee_name"
  | "status"
  | "remarks"
  | "total_quantity"
  | "grand_total"
  | "cancellation_reason"
> & {
  atw_number: string;
  document_type: string;
  invoice_number: string;
  so_number: string;
  created_by_name?: string | null;
  withdrawal_slip_items: Pick<
    WithdrawalSlipItemRow,
    "id" | "description" | "model" | "serial_no" | "barcode" | "quantity" | "uom" | "total_amount"
  >[];
};

export function withdrawalSlipPrintDocument(slip: WithdrawalSlipPrintSource): PrintDocument {
  const sourceLabel = slip.document_type === "dr" ? "Delivery Receipt" : "ATW";
  return baseDocument(
    slip,
    [
      { label: sourceLabel, value: text(slip.atw_number) },
      { label: "Invoice", value: text(slip.invoice_number) },
      { label: "Sales order", value: text(slip.so_number) },
    ],
    ["Item", "Qty", "Amount"],
    slip.withdrawal_slip_items.map((line) => ({
      id: line.id,
      title: lineTitle(line.description, line.model),
      detail: lineDetail(line),
      values: [`${formatQty(line.quantity)} ${line.uom}`, formatMoney(line.total_amount)],
    })),
    "Withdrawal Slip",
    slip.ws_number,
    null,
  );
}
