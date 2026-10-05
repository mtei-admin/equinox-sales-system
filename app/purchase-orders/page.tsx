import { Card, PageHeader, PrimaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/can";
import { PurchasingListFilters } from "@/components/purchasing-list-filters";
import { parsePurchasingFilters } from "@/lib/purchasing/filters";
import { listPurchaseOrders } from "@/lib/purchasing/queries";
import { formatDate, formatMoney } from "@/lib/utils";

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "for_approval", label: "For approval" },
  { value: "approved", label: "Approved" },
  { value: "partially_shipped", label: "Partially shipped" },
  { value: "fully_shipped", label: "Fully shipped" },
  { value: "partially_received", label: "Partially received" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parsePurchasingFilters(await searchParams);
  const rows = await listPurchaseOrders(filters.q, filters.status, filters.from, filters.to);
  const filtered = Boolean(filters.q || filters.status !== "all" || filters.from || filters.to);

  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Approval does not change stock. Inventory increases only when a receiving report is posted."
        actions={
          <Can permission="purchase-orders.write">
            <PrimaryLink href="/purchase-orders/new">New purchase order</PrimaryLink>
          </Can>
        }
      />
      <Card>
        <PurchasingListFilters
          action="/purchase-orders"
          q={filters.q}
          status={filters.status}
          from={filters.from}
          to={filters.to}
          statuses={STATUSES}
          placeholder="PO number or supplier"
        />
        <DataTable headers={["PO number", "Supplier", "PO date", "Expected delivery", "Total amount", "Status"]}>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-eq-mist/60">
              <td className="px-4 py-3 font-mono text-xs">
                <a className="text-eq-navy underline" href={`/purchase-orders/${row.id}`}>{row.po_number}</a>
              </td>
              <td className="px-4 py-3">
                <a className="text-eq-navy underline" href={`/suppliers/${row.supplier_id}`}>{row.supplier_name}</a>
              </td>
              <td className="px-4 py-3">{formatDate(row.po_date)}</td>
              <td className="px-4 py-3">{formatDate(row.expected_delivery_date)}</td>
              <td className="px-4 py-3">{formatMoney(row.grand_total)}</td>
              <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </DataTable>
        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching purchase orders" : "No purchase orders"}
            description={filtered ? "Try a different search, date, or status." : "Create a draft, then submit it for approval."}
          />
        ) : null}
      </Card>
    </>
  );
}
