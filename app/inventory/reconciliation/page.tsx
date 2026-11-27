import { Card, PageHeader, SecondaryLink } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { inputClassName } from "@/components/form-field";
import { enrollInventoryUnitAction } from "@/lib/inventory/actions";
import { listCompanyStock, listInventoryUnits, listItems, listWarehouseOnHand, listWarehouses } from "@/lib/data/queries";
import { isLegacyWarehouse } from "@/lib/inventory/presentation";
import { requirePermission } from "@/lib/auth/guards";
import { formatQty } from "@/lib/utils";

export default async function ReconciliationPage() {
  await requirePermission("inventory.write");
  const [company, warehouses, onHand, units, items] = await Promise.all([
    listCompanyStock(),
    listWarehouses(),
    listWarehouseOnHand(),
    listInventoryUnits(),
    listItems({ q: "", status: "active" }),
  ]);
  const unmapped = onHand.filter((row) => isLegacyWarehouse(row.warehouse_name) && row.on_hand > 0);
  const enrolledByItem = new Map<string, number>();
  for (const unit of units) {
    enrolledByItem.set(unit.item_id, (enrolledByItem.get(unit.item_id) ?? 0) + 1);
  }
  const untagged = company.filter((row) => row.on_hand > 0 && (enrolledByItem.get(row.item_id) ?? 0) < row.on_hand);

  return (
    <>
      <PageHeader
        title="Opening stock reconciliation"
        description="Legacy Main balances stay where they are. Enroll a manufacturer serial or internal unit barcode during the count. This does not create stock or assign a warehouse."
        actions={<SecondaryLink href="/inventory">Back to stock</SecondaryLink>}
      />
      <Card className="mb-4">
        <h2 className="border-b border-eq-line px-4 py-3 text-sm font-semibold">Unmapped Main balances</h2>
        <DataTable headers={["Item", "On hand on Main"]}>
          {unmapped.map((row) => {
            const item = company.find((entry) => entry.item_id === row.item_id);
            return (
              <tr key={row.item_id}>
                <td className="px-4 py-3">{item?.item_name ?? row.item_id}</td>
                <td className="px-4 py-3">{formatQty(row.on_hand)}</td>
              </tr>
            );
          })}
        </DataTable>
        {unmapped.length === 0 ? <EmptyState title="No Main balance" description="There is no on-hand quantity sitting on the legacy Main warehouse." /> : null}
      </Card>
      <Card className="mb-4">
        <h2 className="border-b border-eq-line px-4 py-3 text-sm font-semibold">Untagged units</h2>
        <p className="px-4 py-2 text-xs text-eq-slate">On-hand quantity with fewer enrolled serials or unit barcodes than units on hand. Serials are not generated.</p>
        <DataTable headers={["Item", "On hand", "Enrolled", "Untagged"]}>
          {untagged.map((row) => {
            const enrolled = enrolledByItem.get(row.item_id) ?? 0;
            return (
              <tr key={row.item_id}>
                <td className="px-4 py-3">{row.item_name}</td>
                <td className="px-4 py-3">{formatQty(row.on_hand)}</td>
                <td className="px-4 py-3">{enrolled}</td>
                <td className="px-4 py-3">{formatQty(row.on_hand - enrolled)}</td>
              </tr>
            );
          })}
        </DataTable>
        {untagged.length === 0 ? <EmptyState title="No untagged balance" description="Every on-hand unit has an enrolled identifier, or there is no on-hand stock." /> : null}
      </Card>
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Enroll a unit</h2>
        <p className="mt-1 text-sm text-eq-slate">Leave warehouse blank when the count has not placed the unit yet. Use an adjustment with a reason to correct a quantity.</p>
        <form action={enrollInventoryUnitAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase text-eq-slate">Item</span>
            <select className={inputClassName} name="item_id" required>
              <option value="">Select item…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase text-eq-slate">Warehouse</span>
            <select className={inputClassName} name="warehouse_id" defaultValue="">
              <option value="">Not assigned</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {isLegacyWarehouse(warehouse.name) ? `${warehouse.name} (legacy)` : warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase text-eq-slate">Kind</span>
            <select className={inputClassName} name="identifier_kind" defaultValue="manufacturer_serial">
              <option value="manufacturer_serial">Manufacturer serial</option>
              <option value="internal_barcode">Internal unit barcode</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase text-eq-slate">Serial or unit barcode</span>
            <input className={inputClassName} name="identifier" required />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="rounded-md bg-eq-navy px-4 py-2 text-sm font-medium text-white">Enroll unit</button>
          </div>
        </form>
      </Card>
    </>
  );
}
