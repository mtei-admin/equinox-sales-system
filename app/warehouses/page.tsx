import { Card, PageHeader, PrimaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { listWarehouses } from "@/lib/data/queries";
import { isLegacyWarehouse } from "@/lib/inventory/presentation";

export default async function WarehousesPage() {
  const rows = await listWarehouses();

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Branch warehouses. Main remains the legacy location for stock that has not been reconciled."
      />
      <Card>
        <DataTable headers={["Name", "Notes"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">{row.name}</td>
              <td className="px-4 py-3 text-sm text-eq-slate">
                {isLegacyWarehouse(row.name) ? "Legacy balance. Do not treat this as a branch assignment." : "Branch warehouse"}
              </td>
            </tr>
          ))}
        </DataTable>
        {rows.length === 0 ? (
          <EmptyState title="No warehouses" description="Apply the branch warehouse migration to seed Davao, Cagayan de Oro, Cebu, and Manila." />
        ) : null}
      </Card>
      <p className="mt-4 text-sm text-eq-slate">
        Bills of lading and sales orders stay warehouse-independent. Receiving reports and withdrawal slips each use one warehouse.
        <CanLink />
      </p>
    </>
  );
}

function CanLink() {
  return (
    <>
      {" "}
      <PrimaryLink href="/inventory/reconciliation">Open reconciliation</PrimaryLink>
    </>
  );
}
