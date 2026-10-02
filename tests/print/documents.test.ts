import { describe, expect, it } from "vitest";
import { isPrintPath } from "@/lib/auth/routes";
import { atwPrintDocument, invoicePrintDocument, withdrawalSlipPrintDocument } from "@/lib/print/documents";
import { formatMoney } from "@/lib/utils";

const header = {
  customer_name: "Snapshot Customer",
  delivery_address: "Warehouse door, as captured",
  order_date: "2026-10-02",
  term: "30 days",
  reference_no: "PO-9",
  order_type: "Regular",
  sales_employee_name: "Ada Sales",
  remarks: "Leave at receiving",
  total_quantity: 2,
  grand_total: 21,
  cancellation_reason: null,
  created_by_name: "Mina Clerk",
};

describe("print documents", () => {
  it("prints the invoice snapshot, including prices, and marks a copy", () => {
    const doc = invoicePrintDocument({
      ...header,
      invoice_number: "88421",
      status: "posted",
      so_number: "SO-2026-0008",
      invoice_items: [
        {
          id: "line-1",
          description: "Snapshot widget",
          model: "W-1",
          serial_no: "SN-9",
          barcode: "BC-9",
          quantity: 2,
          uom: "pc",
          unit_price: 10,
          tax_amount: 1,
          total_amount: 21,
        },
      ],
    });

    expect(doc.title).toBe("Invoice");
    expect(doc.number).toBe("88421");
    expect(doc.customerName).toBe("Snapshot Customer");
    expect(doc.deliveryAddress).toBe("Warehouse door, as captured");
    expect(doc.meta.find((field) => field.label === "Sales order")?.value).toBe("SO-2026-0008");
    expect(doc.lines[0]?.title).toBe("Snapshot widget");
    expect(doc.lines[0]?.detail).toBe("W-1 · SN-9 · BC-9");
    expect(doc.lines[0]?.values).toEqual(["2 pc", formatMoney(10), formatMoney(1), formatMoney(21)]);
    expect(doc.note).toMatch(/pre-printed/i);
    expect(doc.cancelled).toBe(false);
    expect(doc.preparedBy).toBe("Mina Clerk");
  });

  it("marks a cancelled invoice and keeps the cancellation reason", () => {
    const doc = invoicePrintDocument({
      ...header,
      invoice_number: "88422",
      status: "cancelled",
      cancellation_reason: "Wrong customer",
      so_number: "SO-2026-0008",
      invoice_items: [],
    });

    expect(doc.cancelled).toBe(true);
    expect(doc.cancellationReason).toBe("Wrong customer");
    expect(doc.customerName).toBe("Snapshot Customer");
  });

  it("titles ATW and delivery receipt from the stored document type", () => {
    const lines = [
      {
        id: "line-1",
        description: "Snapshot widget",
        model: "W-1",
        serial_no: null,
        barcode: null,
        quantity: 1,
        uom: "pc",
        unit_price: 10,
        total_amount: 10,
      },
    ];
    const shared = {
      ...header,
      atw_number: "ATW-2026-0003",
      invoice_number: "88421",
      so_number: "SO-2026-0008",
      status: "released" as const,
      atw_document_items: lines,
    };

    expect(atwPrintDocument({ ...shared, document_type: "atw" }).title).toBe("Authority To Withdraw");
    expect(atwPrintDocument({ ...shared, document_type: "dr" }).title).toBe("Delivery Receipt");
    expect(atwPrintDocument({ ...shared, document_type: "dr" }).lines[0]?.values[1]).toBe(formatMoney(10));
  });

  it("prints the withdrawal slip from the ATW snapshot quantities", () => {
    const doc = withdrawalSlipPrintDocument({
      ...header,
      ws_number: "WS-2026-0002",
      atw_number: "ATW-2026-0003",
      document_type: "dr",
      invoice_number: "88421",
      so_number: "SO-2026-0008",
      status: "issued",
      withdrawal_slip_items: [
        {
          id: "line-1",
          description: "Snapshot widget",
          model: "W-1",
          serial_no: null,
          barcode: null,
          quantity: 2,
          uom: "pc",
          total_amount: 21,
        },
      ],
    });

    expect(doc.title).toBe("Withdrawal Slip");
    expect(doc.number).toBe("WS-2026-0002");
    expect(doc.meta.find((field) => field.label === "Delivery Receipt")?.value).toBe("ATW-2026-0003");
    expect(doc.lines[0]?.values).toEqual(["2 pc", formatMoney(21)]);
    expect(doc.columns).toEqual(["Item", "Qty", "Amount"]);
  });
});

describe("print paths", () => {
  it("recognizes document print routes and not the detail page", () => {
    expect(isPrintPath("/invoices/abc/print")).toBe(true);
    expect(isPrintPath("/atw-dr/abc/print")).toBe(true);
    expect(isPrintPath("/withdrawal-slips/abc/print")).toBe(true);
    expect(isPrintPath("/invoices/abc")).toBe(false);
    expect(isPrintPath("/invoices/abc/print/extra")).toBe(false);
  });
});
