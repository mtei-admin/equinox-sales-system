import { assertQtyWithinRemaining, consumedQty, remainingQty } from "@/lib/business/remaining";
import type { AtwStatus } from "@/types/database";

export type InvoiceAllocationLine = {
  id: string;
  quantity: number;
};

export type AtwQtyConsumption = {
  invoice_item_id: string;
  quantity: number;
  atw_status: AtwStatus;
};

export function invoiceItemAtwQty(invoiceItemId: string, atwLines: AtwQtyConsumption[]) {
  return consumedQty(
    atwLines
      .filter((row) => row.invoice_item_id === invoiceItemId)
      .map((row) => ({ quantity: row.quantity, cancelled: row.atw_status === "cancelled" })),
  );
}

export function invoiceItemRemainingQty(invoiced: number, invoiceItemId: string, atwLines: AtwQtyConsumption[]) {
  return remainingQty(invoiced, invoiceItemAtwQty(invoiceItemId, atwLines));
}

export function allocateInvoiceLine(invoiced: number, allocated: number) {
  return {
    invoiced,
    allocated,
    remaining: remainingQty(invoiced, allocated),
  };
}

export function allocateInvoiceLines(lines: InvoiceAllocationLine[], atwLines: AtwQtyConsumption[]) {
  return lines.map((line) => {
    const allocated = invoiceItemAtwQty(line.id, atwLines);
    return {
      invoice_item_id: line.id,
      ...allocateInvoiceLine(line.quantity, allocated),
    };
  });
}

export function invoiceHeaderRemaining(lines: InvoiceAllocationLine[], atwLines: AtwQtyConsumption[]) {
  return remainingQty(
    lines.reduce((sum, line) => sum + line.quantity, 0),
    lines.reduce((sum, line) => sum + invoiceItemAtwQty(line.id, atwLines), 0),
  );
}

export function invoiceFullyAllocated(lines: InvoiceAllocationLine[], atwLines: AtwQtyConsumption[]) {
  if (lines.length === 0) return false;
  return lines.every((line) => invoiceItemRemainingQty(line.quantity, line.id, atwLines) <= 0);
}

export function eligibleInvoiceLinesForAtw(lines: InvoiceAllocationLine[], atwLines: AtwQtyConsumption[]) {
  return allocateInvoiceLines(lines, atwLines).filter((row) => row.remaining > 0);
}

export function assertAtwAllocation(
  invoiceLines: InvoiceAllocationLine[],
  existingAtwLines: AtwQtyConsumption[],
  nextLines: { invoice_item_id: string; quantity: number }[],
) {
  if (nextLines.length < 1) {
    throw new Error("At least one line is required");
  }
  for (const next of nextLines) {
    const invoiceLine = invoiceLines.find((line) => line.id === next.invoice_item_id);
    if (!invoiceLine) {
      throw new Error("ATW line does not belong to the invoice");
    }
    const alreadyAllocated = invoiceItemAtwQty(invoiceLine.id, existingAtwLines);
    assertQtyWithinRemaining(invoiceLine.quantity, alreadyAllocated, next.quantity, "ATW");
  }
}

export function assertCanCreateAtw(
  invoiceStatus: string,
  invoiceLines: InvoiceAllocationLine[],
  existingAtwLines: AtwQtyConsumption[],
  nextLines: { invoice_item_id: string; quantity: number }[],
) {
  if (invoiceStatus !== "posted") {
    throw new Error("ATW/DR requires a posted invoice");
  }
  if (invoiceFullyAllocated(invoiceLines, existingAtwLines)) {
    throw new Error("Invoice is already fully allocated to ATW/DR");
  }
  assertAtwAllocation(invoiceLines, existingAtwLines, nextLines);
}
