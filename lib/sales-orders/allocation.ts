import { assertQtyWithinRemaining, consumedQty, remainingQty } from "@/lib/business/remaining";
import type { InvoiceStatus } from "@/types/database";

export type SoAllocationLine = {
  id: string;
  quantity: number;
};

export type InvoiceQtyConsumption = {
  sales_order_item_id: string;
  quantity: number;
  invoice_status: InvoiceStatus;
};

export function soItemInvoicedQty(soItemId: string, invoiceLines: InvoiceQtyConsumption[]) {
  return consumedQty(
    invoiceLines
      .filter((row) => row.sales_order_item_id === soItemId)
      .map((row) => ({ quantity: row.quantity, cancelled: row.invoice_status === "cancelled" })),
  );
}

export function soItemRemainingQty(ordered: number, soItemId: string, invoiceLines: InvoiceQtyConsumption[]) {
  return remainingQty(ordered, soItemInvoicedQty(soItemId, invoiceLines));
}

export function allocateSoLine(ordered: number, invoiced: number) {
  return {
    ordered,
    invoiced,
    remaining: remainingQty(ordered, invoiced),
  };
}

export function allocateSoLines(lines: SoAllocationLine[], invoiceLines: InvoiceQtyConsumption[]) {
  return lines.map((line) => {
    const invoiced = soItemInvoicedQty(line.id, invoiceLines);
    return {
      sales_order_item_id: line.id,
      ...allocateSoLine(line.quantity, invoiced),
    };
  });
}

export function soHeaderRemaining(lines: SoAllocationLine[], invoiceLines: InvoiceQtyConsumption[]) {
  return remainingQty(
    lines.reduce((sum, line) => sum + line.quantity, 0),
    lines.reduce((sum, line) => sum + soItemInvoicedQty(line.id, invoiceLines), 0),
  );
}

export function soFullyInvoiced(lines: SoAllocationLine[], invoiceLines: InvoiceQtyConsumption[]) {
  if (lines.length === 0) return false;
  return lines.every((line) => soItemRemainingQty(line.quantity, line.id, invoiceLines) <= 0);
}

export function eligibleSoLinesForInvoice(lines: SoAllocationLine[], invoiceLines: InvoiceQtyConsumption[]) {
  return allocateSoLines(lines, invoiceLines).filter((row) => row.remaining > 0);
}

export function assertInvoiceAllocation(
  soLines: SoAllocationLine[],
  existingInvoiceLines: InvoiceQtyConsumption[],
  nextLines: { sales_order_item_id: string; quantity: number }[],
) {
  if (nextLines.length < 1) {
    throw new Error("At least one line is required");
  }
  for (const next of nextLines) {
    const soLine = soLines.find((line) => line.id === next.sales_order_item_id);
    if (!soLine) {
      throw new Error("Invoice line does not belong to the sales order");
    }
    const alreadyInvoiced = soItemInvoicedQty(soLine.id, existingInvoiceLines);
    assertQtyWithinRemaining(soLine.quantity, alreadyInvoiced, next.quantity, "Invoice");
  }
}

export function assertCanCreateInvoice(
  soStatus: string,
  soLines: SoAllocationLine[],
  existingInvoiceLines: InvoiceQtyConsumption[],
  nextLines: { sales_order_item_id: string; quantity: number }[],
) {
  if (soStatus !== "open") {
    throw new Error("Sales order must be open to invoice");
  }
  if (soFullyInvoiced(soLines, existingInvoiceLines)) {
    throw new Error("Sales order is already fully invoiced");
  }
  assertInvoiceAllocation(soLines, existingInvoiceLines, nextLines);
}
