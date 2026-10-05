import Link from "next/link";
import { Card, PageHeader } from "@/components/page-header";
import { ReportFiltersForm } from "@/components/reports/report-filters";
import { PipelineCards } from "@/components/reports/pipeline-cards";
import { SalesPendingTables, WarehousePendingTables } from "@/components/reports/pending-tables";
import {
  AtwSnapshotTable,
  InvoiceSnapshotTable,
  ReportSection,
  SalesOrderSnapshotTable,
  SlipSnapshotTable,
} from "@/components/reports/document-tables";
import { requireProfile } from "@/lib/auth/guards";
import { canAccessModule } from "@/lib/permissions/policies";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import { listActiveUsers, listCustomers } from "@/lib/data/queries";
import { loadOperationsSnapshot } from "@/lib/data/reports";
import { hasReportFilters, parseReportFilters } from "@/lib/reports/filters";
import {
  pipelineTotals,
  salesPendingActions,
  warehousePendingActions,
} from "@/lib/reports/pipeline";
import { dashboardDescription, dashboardViewFor } from "@/lib/reports/roles";
import { purchasingIndicators } from "@/lib/purchasing/queries";
import type { ModuleKey } from "@/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
  const filters = parseReportFilters(await searchParams);
  const view = dashboardViewFor(profile.role);
  const [snapshot, customers, employees, purchasing] = await Promise.all([
    loadOperationsSnapshot(filters),
    listCustomers({ q: "", status: "active" }),
    listActiveUsers(),
    purchasingIndicators(),
  ]);
  const filtered = hasReportFilters(filters);
  const totals = pipelineTotals(snapshot.orders, snapshot.invoices, snapshot.atw);
  const salesPending = salesPendingActions(snapshot.orders, snapshot.invoices, snapshot.atw);
  const warehousePending = warehousePendingActions(snapshot.atw, snapshot.slips);
  const emptyHint = filtered
    ? "Try a different date, customer, document number, status, or sales employee."
    : "Documents appear here after they are created.";

  const tiles = (
    [
      { label: "Customers", value: snapshot.customers, href: "/customers", module: "customers" },
      {
        label: "Sales orders",
        value: snapshot.orders.filter((row) => row.status !== "cancelled").length,
        href: "/sales-orders",
        module: "sales-orders",
      },
      {
        label: "Invoices",
        value: snapshot.invoices.filter((row) => row.status !== "cancelled").length,
        href: "/invoices",
        module: "invoices",
      },
      {
        label: "ATW / DR",
        value: snapshot.atw.filter((row) => row.status !== "cancelled").length,
        href: "/atw-dr",
        module: "atw-dr",
      },
      {
        label: "Issued slips",
        value: snapshot.slips.filter((row) => row.status === "issued").length,
        href: "/withdrawal-slips",
        module: "withdrawal-slips",
      },
    ] satisfies { label: string; value: number; href: string; module: ModuleKey }[]
  ).filter((tile) => canAccessModule(profile.role, tile.module));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${ROLE_LABELS[profile.role]}. ${dashboardDescription(profile.role)}`}
      />
      <Card className="mb-6">
        <ReportFiltersForm action="/dashboard" filters={filters} customers={customers} employees={employees} />
      </Card>
      {view.showFullCounts ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {tiles.map((tile) => (
            <Link key={tile.label} href={tile.href}>
              <Card className="p-4 hover:border-eq-navy">
                <p className="text-xs uppercase tracking-wide text-eq-slate">{tile.label}</p>
                <p className="mt-2 text-3xl font-semibold text-eq-ink">{tile.value}</p>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
      {canAccessModule(profile.role, "purchase-orders") ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Awaiting approval", value: purchasing.awaiting, href: "/purchase-orders?status=for_approval" },
            { label: "Open purchase orders", value: purchasing.openPo, href: "/purchase-orders" },
            { label: "Incoming shipments", value: purchasing.inTransit, href: "/bills-of-lading" },
            { label: "Open shortages", value: purchasing.openShort, href: "/receiving-reports" },
          ].map((tile) => (
            <Link key={tile.label} href={tile.href}>
              <Card className="p-4 hover:border-eq-navy">
                <p className="text-xs uppercase tracking-wide text-eq-slate">{tile.label}</p>
                <p className="mt-2 text-3xl font-semibold text-eq-ink">{tile.value}</p>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
      {view.showPipeline ? (
        <div className="mb-6">
          <PipelineCards totals={totals} />
        </div>
      ) : null}
      {view.showSalesPending ? (
        <div className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-eq-slate">Pending actions</h2>
          <SalesPendingTables
            draftOrders={salesPending.draft_orders}
            openOrders={salesPending.open_orders}
            draftInvoices={salesPending.draft_invoices}
            postedInvoices={salesPending.posted_invoices}
            draftAtw={salesPending.draft_atw}
            showActionLinks={view.showActionLinks}
          />
        </div>
      ) : null}
      {view.showWarehousePending ? (
        <div className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-eq-slate">Warehouse pending</h2>
          <WarehousePendingTables
            awaiting={warehousePending.awaiting_withdrawal}
            draftSlips={warehousePending.draft_slips}
            showActionLinks={view.showActionLinks}
          />
        </div>
      ) : null}
      {view.showSalesDocuments ? (
        <div className="mb-6 grid gap-4 xl:grid-cols-1">
          <ReportSection title="Sales orders">
            <SalesOrderSnapshotTable
              orders={snapshot.orders}
              previewRows
              emptyTitle={filtered ? "No matching sales orders" : "No sales orders"}
              emptyDescription={emptyHint}
            />
          </ReportSection>
          <ReportSection title="Invoices">
            <InvoiceSnapshotTable
              invoices={snapshot.invoices}
              previewRows
              emptyTitle={filtered ? "No matching invoices" : "No invoices"}
              emptyDescription={emptyHint}
            />
          </ReportSection>
          <ReportSection title="ATW / DR">
            <AtwSnapshotTable
              docs={snapshot.atw}
              previewRows
              emptyTitle={filtered ? "No matching ATW/DR documents" : "No ATW/DR documents"}
              emptyDescription={emptyHint}
            />
          </ReportSection>
        </div>
      ) : null}
      {view.showWarehouseDocuments ? (
        <ReportSection title="Withdrawal slips">
          <SlipSnapshotTable
            slips={snapshot.slips}
            previewRows
            emptyTitle={filtered ? "No matching withdrawal slips" : "No withdrawal slips"}
            emptyDescription={emptyHint}
          />
        </ReportSection>
      ) : null}
    </>
  );
}
