import type { ReactNode } from "react";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { formatDate, formatMoney, formatQty } from "@/lib/utils";
import type { PipelineAtw, PipelineInvoice, PipelineOrder, PipelineSlip } from "@/lib/reports/pipeline";

const PREVIEW = 8;

function preview<T>(rows: T[]) {
  return { shown: rows.slice(0, PREVIEW), more: rows.length > PREVIEW, total: rows.length };
}

export function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-eq-line bg-white shadow-sm">
      <h2 className="border-b border-eq-line px-4 py-3 text-sm font-semibold text-eq-ink">{title}</h2>
      {children}
    </section>
  );
}

function DocLink({ href, children }: { href: string; children: string }) {
  return (
    <a className="font-mono text-xs text-eq-navy underline" href={href}>
      {children}
    </a>
  );
}

export function SalesOrderSnapshotTable({
  orders,
  remaining,
  previewRows = false,
  emptyTitle,
  emptyDescription,
}: {
  orders: PipelineOrder[];
  remaining?: boolean;
  previewRows?: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { shown, more, total } = previewRows ? preview(orders) : { shown: orders, more: false, total: orders.length };
  return (
    <div>
      <DataTable headers={["Number", "Customer", "Date", "Status", remaining ? "Remaining qty" : "Qty", "Total"]}>
        {shown.map((order) => (
          <tr key={order.id} className="hover:bg-eq-mist/60">
            <td className="px-4 py-3">
              <DocLink href={`/sales-orders/${order.id}`}>{order.so_number}</DocLink>
            </td>
            <td className="px-4 py-3">{order.customer_name}</td>
            <td className="px-4 py-3">{formatDate(order.order_date)}</td>
            <td className="px-4 py-3">
              <StatusBadge status={order.status} />
            </td>
            <td className="px-4 py-3">{formatQty(remaining ? order.remaining_qty : order.total_quantity)}</td>
            <td className="px-4 py-3">{formatMoney(order.grand_total)}</td>
          </tr>
        ))}
      </DataTable>
      {orders.length === 0 ? <EmptyState title={emptyTitle} description={emptyDescription} /> : null}
      {more ? (
        <p className="border-t border-eq-line px-4 py-3 text-sm text-eq-slate">
          Showing {PREVIEW} of {total}.{" "}
          <a className="text-eq-navy underline" href="/sales-orders">
            View all sales orders
          </a>
        </p>
      ) : null}
    </div>
  );
}

export function InvoiceSnapshotTable({
  invoices,
  remaining,
  previewRows = false,
  emptyTitle,
  emptyDescription,
}: {
  invoices: PipelineInvoice[];
  remaining?: boolean;
  previewRows?: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { shown, more, total } = previewRows ? preview(invoices) : { shown: invoices, more: false, total: invoices.length };
  return (
    <div>
      <DataTable headers={["Number", "Customer", "Date", "Status", remaining ? "Remaining qty" : "Qty", "Total"]}>
        {shown.map((invoice) => (
          <tr key={invoice.id} className="hover:bg-eq-mist/60">
            <td className="px-4 py-3">
              <DocLink href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</DocLink>
            </td>
            <td className="px-4 py-3">{invoice.customer_name}</td>
            <td className="px-4 py-3">{formatDate(invoice.order_date)}</td>
            <td className="px-4 py-3">
              <StatusBadge status={invoice.status} />
            </td>
            <td className="px-4 py-3">{formatQty(remaining ? invoice.remaining_qty : invoice.total_quantity)}</td>
            <td className="px-4 py-3">{formatMoney(invoice.grand_total)}</td>
          </tr>
        ))}
      </DataTable>
      {invoices.length === 0 ? <EmptyState title={emptyTitle} description={emptyDescription} /> : null}
      {more ? (
        <p className="border-t border-eq-line px-4 py-3 text-sm text-eq-slate">
          Showing {PREVIEW} of {total}.{" "}
          <a className="text-eq-navy underline" href="/invoices">
            View all invoices
          </a>
        </p>
      ) : null}
    </div>
  );
}

export function AtwSnapshotTable({
  docs,
  awaiting,
  previewRows = false,
  showActionLinks = false,
  emptyTitle,
  emptyDescription,
}: {
  docs: PipelineAtw[];
  awaiting?: boolean;
  previewRows?: boolean;
  showActionLinks?: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { shown, more, total } = previewRows ? preview(docs) : { shown: docs, more: false, total: docs.length };
  const headers = ["Number", "Type", "Customer", "Date", "Status", "Qty"];
  if (showActionLinks) headers.push("Action");
  return (
    <div>
      <DataTable headers={headers}>
        {shown.map((doc) => (
          <tr key={doc.id} className="hover:bg-eq-mist/60">
            <td className="px-4 py-3">
              <DocLink href={`/atw-dr/${doc.id}`}>{doc.atw_number}</DocLink>
            </td>
            <td className="px-4 py-3 uppercase">{doc.document_type}</td>
            <td className="px-4 py-3">{doc.customer_name}</td>
            <td className="px-4 py-3">{formatDate(doc.order_date)}</td>
            <td className="px-4 py-3">
              <StatusBadge status={doc.status} />
            </td>
            <td className="px-4 py-3">{formatQty(doc.total_quantity)}</td>
            {showActionLinks ? (
              <td className="px-4 py-3">
                {awaiting ? (
                  <Can permission="withdrawal-slips.write">
                    <a className="text-sm text-eq-navy underline" href={`/withdrawal-slips/new?atw_id=${doc.id}`}>
                      Create slip
                    </a>
                  </Can>
                ) : null}
              </td>
            ) : null}
          </tr>
        ))}
      </DataTable>
      {docs.length === 0 ? <EmptyState title={emptyTitle} description={emptyDescription} /> : null}
      {more ? (
        <p className="border-t border-eq-line px-4 py-3 text-sm text-eq-slate">
          Showing {PREVIEW} of {total}.{" "}
          <a className="text-eq-navy underline" href="/atw-dr">
            View all ATW/DR
          </a>
        </p>
      ) : null}
    </div>
  );
}

export function SlipSnapshotTable({
  slips,
  previewRows = false,
  emptyTitle,
  emptyDescription,
}: {
  slips: PipelineSlip[];
  previewRows?: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { shown, more, total } = previewRows ? preview(slips) : { shown: slips, more: false, total: slips.length };
  return (
    <div>
      <DataTable headers={["Number", "Customer", "Date", "Status", "Qty", "Total"]}>
        {shown.map((slip) => (
          <tr key={slip.id} className="hover:bg-eq-mist/60">
            <td className="px-4 py-3">
              <DocLink href={`/withdrawal-slips/${slip.id}`}>{slip.ws_number}</DocLink>
            </td>
            <td className="px-4 py-3">{slip.customer_name}</td>
            <td className="px-4 py-3">{formatDate(slip.order_date)}</td>
            <td className="px-4 py-3">
              <StatusBadge status={slip.status} />
            </td>
            <td className="px-4 py-3">{formatQty(slip.total_quantity)}</td>
            <td className="px-4 py-3">{formatMoney(slip.grand_total)}</td>
          </tr>
        ))}
      </DataTable>
      {slips.length === 0 ? <EmptyState title={emptyTitle} description={emptyDescription} /> : null}
      {more ? (
        <p className="border-t border-eq-line px-4 py-3 text-sm text-eq-slate">
          Showing {PREVIEW} of {total}.{" "}
          <a className="text-eq-navy underline" href="/withdrawal-slips">
            View all withdrawal slips
          </a>
        </p>
      ) : null}
    </div>
  );
}
