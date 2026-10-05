import { Card, PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { ReportFiltersForm } from "@/components/reports/report-filters";
import { PipelineCards } from "@/components/reports/pipeline-cards";
import {
  AtwSnapshotTable,
  InvoiceSnapshotTable,
  ReportSection,
  SalesOrderSnapshotTable,
} from "@/components/reports/document-tables";
import { listActiveUsers, listCustomers } from "@/lib/data/queries";
import { listWorkbenchPurchaseOrders } from "@/lib/purchasing/queries";
import { loadOperationsSnapshot } from "@/lib/data/reports";
import { hasReportFilters, parseReportFilters } from "@/lib/reports/filters";
import {
  atwAwaitingWithdrawal,
  pipelineTotals,
  remainingInvoices,
  remainingSalesOrders,
} from "@/lib/reports/pipeline";
import { formatMoney } from "@/lib/utils";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseReportFilters(await searchParams);
  const [snapshot, customers, employees, openOrders] = await Promise.all([
    loadOperationsSnapshot(filters),
    listCustomers({ q: "", status: "active" }),
    listActiveUsers(),
    listWorkbenchPurchaseOrders(),
  ]);
  const filtered = hasReportFilters(filters);
  const remainingOrders = remainingSalesOrders(snapshot.orders);
  const remainingPosted = remainingInvoices(snapshot.invoices);
  const awaiting = atwAwaitingWithdrawal(snapshot.atw);
  const totals = pipelineTotals(snapshot.orders, snapshot.invoices, snapshot.atw);
  const emptyHint = filtered
    ? "Try a different date, customer, document number, status, or sales employee."
    : "Remaining quantity uses the same rules as transactional documents.";

  return (
    <>
      <PageHeader
        title="Reports"
        description="Remaining sales-order quantity, remaining posted-invoice quantity, and released ATW/DR without a non-cancelled withdrawal slip."
      />
      <Card className="mb-6">
        <ReportFiltersForm action="/reports" filters={filters} customers={customers} employees={employees} />
      </Card>
      <div className="mb-6">
        <PipelineCards totals={totals} />
      </div>
      <div className="space-y-4">
        <ReportSection title="Sales orders with remaining quantity">
          <SalesOrderSnapshotTable
            orders={remainingOrders}
            remaining
            emptyTitle={filtered ? "No matching remaining sales orders" : "No remaining sales-order quantity"}
            emptyDescription={emptyHint}
          />
        </ReportSection>
        <ReportSection title="Posted invoices with remaining quantity">
          <InvoiceSnapshotTable
            invoices={remainingPosted}
            remaining
            emptyTitle={filtered ? "No matching remaining invoices" : "No remaining posted-invoice quantity"}
            emptyDescription={emptyHint}
          />
        </ReportSection>
        <ReportSection title="Open purchase orders">
          <DataTable headers={["PO number", "Supplier", "Status", "Amount"]}>
            {openOrders.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-mono text-xs">
                  <a className="text-eq-navy underline" href={`/purchase-orders/${row.id}`}>{row.po_number}</a>
                </td>
                <td className="px-4 py-3">{row.supplier_name}</td>
                <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                <td className="px-4 py-3">{formatMoney(row.grand_total)}</td>
              </tr>
            ))}
          </DataTable>
          {openOrders.length === 0 ? <p className="px-4 py-6 text-sm text-eq-slate">No open purchase orders.</p> : null}
        </ReportSection>
        <ReportSection title="ATW/DR awaiting withdrawal slip">
          <AtwSnapshotTable
            docs={awaiting}
            awaiting
            emptyTitle={filtered ? "No matching ATW/DR awaiting a slip" : "No ATW/DR awaiting a withdrawal slip"}
            emptyDescription={emptyHint}
          />
        </ReportSection>
      </div>
    </>
  );
}
