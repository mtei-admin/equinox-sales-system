import { Card, PageHeader, PrimaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { listWarehouses } from "@/lib/data/queries";

export default async function WarehousesPage() {
  const rows = await listWarehouses();

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="DAVAO (MAIN) holds the stock that was on Main. Cagayan de Oro, Cebu, and Manila are the other branches."
      />
      <Card>
        <DataTable headers={["Name", "Notes"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">{row.name}</td>
              <td className="px-4 py-3 text-sm text-eq-slate">
                {row.name === "DAVAO (MAIN)" ? "Default warehouse. Former Main stock is here." : "Branch warehouse"}
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
