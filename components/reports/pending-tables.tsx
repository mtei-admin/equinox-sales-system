import type { ReactNode } from "react";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { formatDate, formatQty } from "@/lib/utils";
import type { PipelineAtw, PipelineInvoice, PipelineOrder, PipelineSlip } from "@/lib/reports/pipeline";
import type { Permission } from "@/lib/permissions/policies";

function NumberLink({ href, children }: { href: string; children: string }) {
  return (
    <a className="font-mono text-xs text-eq-navy underline" href={href}>
      {children}
    </a>
  );
}

function ActionLink({
  show,
  permission,
  href,
  label,
}: {
  show: boolean;
  permission: Permission;
  href: string;
  label: string;
}) {
  if (!show) return <span className="text-eq-slate">—</span>;
  return (
    <Can permission={permission}>
      <a className="text-sm text-eq-navy underline" href={href}>
        {label}
      </a>
    </Can>
  );
}

export function SalesPendingTables({
  draftOrders,
  openOrders,
  draftInvoices,
  postedInvoices,
  draftAtw,
  showActionLinks,
}: {
  draftOrders: PipelineOrder[];
  openOrders: PipelineOrder[];
  draftInvoices: PipelineInvoice[];
  postedInvoices: PipelineInvoice[];
  draftAtw: PipelineAtw[];
  showActionLinks: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <PendingCard
        title="Draft sales orders"
        empty="No draft sales orders."
        headers={["Number", "Customer", "Date", "Action"]}
      >
        {draftOrders.map((order) => (
          <tr key={order.id} className="hover:bg-eq-mist/60">
            <td className="px-4 py-3">
              <NumberLink href={`/sales-orders/${order.id}`}>{order.so_number}</NumberLink>
            </td>
            <td className="px-4 py-3">{order.customer_name}</td>
            <td className="px-4 py-3">{formatDate(order.order_date)}</td>
            <td className="px-4 py-3">
              <ActionLink
                show={showActionLinks}
                permission="sales-orders.write"
                href={`/sales-orders/${order.id}/edit`}
                label="Continue"
              />
            </td>
          </tr>
        ))}
      </PendingCard>
      <PendingCard
        title="Open orders with remaining qty"
        empty="No open sales orders with remaining quantity."
        headers={["Number", "Customer", "Remaining", "Action"]}
      >
        {openOrders.map((order) => (
          <tr key={order.id} className="hover:bg-eq-mist/60">
            <td className="px-4 py-3">
              <NumberLink href={`/sales-orders/${order.id}`}>{order.so_number}</NumberLink>
            </td>
            <td className="px-4 py-3">{order.customer_name}</td>
            <td className="px-4 py-3">{formatQty(order.remaining_qty)}</td>
            <td className="px-4 py-3">
              <ActionLink
                show={showActionLinks}
                permission="invoices.write"
                href={`/invoices/new?sales_order_id=${order.id}`}
                label="Create invoice"
              />
            </td>
          </tr>
        ))}
      </PendingCard>
      <PendingCard
        title="Draft invoices"
        empty="No draft invoices."
        headers={["Number", "Customer", "Date", "Action"]}
      >
        {draftInvoices.map((invoice) => (
          <tr key={invoice.id} className="hover:bg-eq-mist/60">
            <td className="px-4 py-3">
              <NumberLink href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</NumberLink>
            </td>
            <td className="px-4 py-3">{invoice.customer_name}</td>
            <td className="px-4 py-3">{formatDate(invoice.order_date)}</td>
            <td className="px-4 py-3">
              <ActionLink
                show={showActionLinks}
                permission="invoices.write"
                href={`/invoices/${invoice.id}`}
                label="Open"
              />
            </td>
          </tr>
        ))}
      </PendingCard>
      <PendingCard
        title="Posted invoices with remaining qty"
        empty="No posted invoices with remaining quantity."
        headers={["Number", "Customer", "Remaining", "Action"]}
      >
        {postedInvoices.map((invoice) => (
          <tr key={invoice.id} className="hover:bg-eq-mist/60">
            <td className="px-4 py-3">
              <NumberLink href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</NumberLink>
            </td>
            <td className="px-4 py-3">{invoice.customer_name}</td>
            <td className="px-4 py-3">{formatQty(invoice.remaining_qty)}</td>
            <td className="px-4 py-3">
              <ActionLink
                show={showActionLinks}
                permission="atw-dr.write"
                href={`/atw-dr/new?invoice_id=${invoice.id}`}
                label="Create ATW/DR"
              />
            </td>
          </tr>
        ))}
      </PendingCard>
      <PendingCard
        title="Draft ATW/DR"
        empty="No draft ATW/DR documents."
        headers={["Number", "Customer", "Date", "Action"]}
      >
        {draftAtw.map((doc) => (
          <tr key={doc.id} className="hover:bg-eq-mist/60">
            <td className="px-4 py-3">
              <NumberLink href={`/atw-dr/${doc.id}`}>{doc.atw_number}</NumberLink>
            </td>
            <td className="px-4 py-3">{doc.customer_name}</td>
            <td className="px-4 py-3">{formatDate(doc.order_date)}</td>
            <td className="px-4 py-3">
              <ActionLink
                show={showActionLinks}
                permission="atw-dr.write"
                href={`/atw-dr/${doc.id}`}
                label="Open"
              />
            </td>
          </tr>
        ))}
      </PendingCard>
    </div>
  );
}

export function WarehousePendingTables({
  awaiting,
  draftSlips,
  showActionLinks,
}: {
  awaiting: PipelineAtw[];
  draftSlips: PipelineSlip[];
  showActionLinks: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <PendingCard
        title="ATW/DR pending withdrawal"
        empty="No released ATW/DR documents waiting for a withdrawal slip."
        headers={["Number", "Type", "Customer", "Qty", "Action"]}
      >
        {awaiting.map((doc) => (
          <tr key={doc.id} className="hover:bg-eq-mist/60">
            <td className="px-4 py-3">
              <NumberLink href={`/atw-dr/${doc.id}`}>{doc.atw_number}</NumberLink>
            </td>
            <td className="px-4 py-3 uppercase">{doc.document_type}</td>
            <td className="px-4 py-3">{doc.customer_name}</td>
            <td className="px-4 py-3">{formatQty(doc.total_quantity)}</td>
            <td className="px-4 py-3">
              <ActionLink
                show={showActionLinks}
                permission="withdrawal-slips.write"
                href={`/withdrawal-slips/new?atw_id=${doc.id}`}
                label="Create slip"
              />
            </td>
          </tr>
        ))}
      </PendingCard>
      <PendingCard
        title="Draft withdrawal slips"
        empty="No draft withdrawal slips."
        headers={["Number", "Customer", "Status", "Action"]}
      >
        {draftSlips.map((slip) => (
          <tr key={slip.id} className="hover:bg-eq-mist/60">
            <td className="px-4 py-3">
              <NumberLink href={`/withdrawal-slips/${slip.id}`}>{slip.ws_number}</NumberLink>
            </td>
            <td className="px-4 py-3">{slip.customer_name}</td>
            <td className="px-4 py-3">
              <StatusBadge status={slip.status} />
            </td>
            <td className="px-4 py-3">
              <ActionLink
                show={showActionLinks}
                permission="withdrawal-slips.write"
                href={`/withdrawal-slips/${slip.id}/edit`}
                label="Continue"
              />
            </td>
          </tr>
        ))}
      </PendingCard>
    </div>
  );
}

function PendingCard({
  title,
  empty,
  headers,
  children,
}: {
  title: string;
  empty: string;
  headers: string[];
  children: ReactNode;
}) {
  const rows = Array.isArray(children) ? children : [children];
  const hasRows = rows.filter(Boolean).length > 0;
  return (
    <section className="rounded-xl border border-eq-line bg-white shadow-sm">
      <h2 className="border-b border-eq-line px-4 py-3 text-sm font-semibold text-eq-ink">{title}</h2>
      <DataTable headers={headers}>{children}</DataTable>
      {hasRows ? null : <EmptyState title={empty} description="Nothing is waiting in this queue." />}
    </section>
  );
}
