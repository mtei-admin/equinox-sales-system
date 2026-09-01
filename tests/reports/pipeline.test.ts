import { describe, expect, it } from "vitest";
import {
  atwAwaitingWithdrawal,
  pipelineTotals,
  remainingInvoices,
  remainingSalesOrders,
  salesPendingActions,
  warehousePendingActions,
} from "@/lib/reports/pipeline";
import { computeInvoiceRemaining, computeSoRemaining } from "@/lib/reports/pipeline";

const pipe = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const customer = "11111111-1111-4111-8111-111111111111";

describe("report pipeline (D19)", () => {
  it("computes remaining SO qty from non-cancelled invoices using existing allocation", () => {
    const remaining = computeSoRemaining(
      [{ id: pipe, quantity: 10 }],
      [
        { sales_order_item_id: pipe, quantity: 4, invoice_status: "posted" },
        { sales_order_item_id: pipe, quantity: 2, invoice_status: "cancelled" },
      ],
    );
    expect(remaining).toBe(6);
  });

  it("computes remaining invoice qty from non-cancelled ATW/DR using existing allocation", () => {
    const remaining = computeInvoiceRemaining(
      [{ id: pipe, quantity: 10 }],
      [
        { invoice_item_id: pipe, quantity: 3, atw_status: "released" },
        { invoice_item_id: pipe, quantity: 2, atw_status: "cancelled" },
      ],
    );
    expect(remaining).toBe(7);
  });

  it("lists remaining SO, remaining posted invoices, and ATW without an active slip", () => {
    const orders = [
      {
        id: "o1",
        so_number: "SO-1",
        customer_id: customer,
        customer_name: "Northwind",
        order_date: "2026-09-01",
        sales_employee_id: null,
        sales_employee_name: null,
        status: "open" as const,
        total_quantity: 10,
        grand_total: 1000,
        remaining_qty: 6,
      },
      {
        id: "o2",
        so_number: "SO-2",
        customer_id: customer,
        customer_name: "Northwind",
        order_date: "2026-09-01",
        sales_employee_id: null,
        sales_employee_name: null,
        status: "cancelled" as const,
        total_quantity: 5,
        grand_total: 200,
        remaining_qty: 5,
      },
    ];
    const invoices = [
      {
        id: "i1",
        invoice_number: "INV-1",
        sales_order_id: "o1",
        customer_id: customer,
        customer_name: "Northwind",
        order_date: "2026-09-01",
        sales_employee_id: null,
        sales_employee_name: null,
        status: "posted" as const,
        total_quantity: 4,
        grand_total: 400,
        remaining_qty: 4,
      },
      {
        id: "i2",
        invoice_number: "INV-2",
        sales_order_id: "o1",
        customer_id: customer,
        customer_name: "Northwind",
        order_date: "2026-09-01",
        sales_employee_id: null,
        sales_employee_name: null,
        status: "draft" as const,
        total_quantity: 1,
        grand_total: 100,
        remaining_qty: 1,
      },
    ];
    const atw = [
      {
        id: "a1",
        atw_number: "ATW-1",
        document_type: "atw",
        invoice_id: "i1",
        customer_id: customer,
        customer_name: "Northwind",
        order_date: "2026-09-01",
        sales_employee_id: null,
        sales_employee_name: null,
        status: "released" as const,
        total_quantity: 4,
        grand_total: 400,
        has_active_slip: false,
        active_withdrawal_slip_id: null,
      },
      {
        id: "a2",
        atw_number: "ATW-2",
        document_type: "dr",
        invoice_id: "i1",
        customer_id: customer,
        customer_name: "Northwind",
        order_date: "2026-09-01",
        sales_employee_id: null,
        sales_employee_name: null,
        status: "released" as const,
        total_quantity: 1,
        grand_total: 100,
        has_active_slip: true,
        active_withdrawal_slip_id: "w1",
      },
    ];
    expect(remainingSalesOrders(orders)).toHaveLength(1);
    expect(remainingInvoices(invoices)).toHaveLength(1);
    expect(atwAwaitingWithdrawal(atw)).toEqual([atw[0]]);
    expect(pipelineTotals(orders, invoices, atw)).toEqual({
      remaining_so_count: 1,
      remaining_so_qty: 6,
      remaining_invoice_count: 1,
      remaining_invoice_qty: 4,
      awaiting_withdrawal_count: 1,
    });
  });

  it("builds sales and warehouse pending queues without changing document rules", () => {
    const pending = salesPendingActions(
      [
        {
          id: "o1",
          so_number: "SO-1",
          customer_id: customer,
          customer_name: "Northwind",
          order_date: "2026-09-01",
          sales_employee_id: null,
          sales_employee_name: null,
          status: "draft",
          total_quantity: 1,
          grand_total: 10,
          remaining_qty: 1,
        },
      ],
      [],
      [],
    );
    expect(pending.draft_orders).toHaveLength(1);
    expect(pending.open_orders).toHaveLength(0);
    const warehouse = warehousePendingActions(
      [
        {
          id: "a1",
          atw_number: "ATW-1",
          document_type: "atw",
          invoice_id: "i1",
          customer_id: customer,
          customer_name: "Northwind",
          order_date: "2026-09-01",
          sales_employee_id: null,
          sales_employee_name: null,
          status: "released",
          total_quantity: 2,
          grand_total: 20,
          has_active_slip: false,
          active_withdrawal_slip_id: null,
        },
      ],
      [
        {
          id: "w1",
          ws_number: "WS-1",
          atw_id: "a2",
          customer_id: customer,
          customer_name: "Northwind",
          order_date: "2026-09-01",
          sales_employee_id: null,
          sales_employee_name: null,
          status: "draft",
          total_quantity: 2,
          grand_total: 20,
        },
      ],
    );
    expect(warehouse.awaiting_withdrawal).toHaveLength(1);
    expect(warehouse.draft_slips).toHaveLength(1);
  });
});
