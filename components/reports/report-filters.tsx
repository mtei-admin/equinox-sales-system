import { inputClassName } from "@/components/form-field";
import type { ReportFilters, ReportStatus } from "@/lib/reports/filters";
import type { CustomerRow, UserRow } from "@/types/database";

const STATUSES: { value: ReportStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "posted", label: "Posted" },
  { value: "released", label: "Released" },
  { value: "issued", label: "Issued" },
  { value: "cancelled", label: "Cancelled" },
];

export function ReportFiltersForm({
  action,
  filters,
  customers,
  employees,
}: {
  action: "/dashboard" | "/reports";
  filters: ReportFilters;
  customers: Pick<CustomerRow, "id" | "name">[];
  employees: Pick<UserRow, "id" | "full_name" | "username">[];
}) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3 border-b border-eq-line px-4 py-3">
      <label className="w-40">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">From date</span>
        <input className={inputClassName} type="date" name="date_from" defaultValue={filters.date_from} />
      </label>
      <label className="w-40">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">To date</span>
        <input className={inputClassName} type="date" name="date_to" defaultValue={filters.date_to} />
      </label>
      <label className="min-w-[12rem] flex-1">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">Customer</span>
        <select className={inputClassName} name="customer_id" defaultValue={filters.customer_id}>
          <option value="">All customers</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-[12rem] flex-1">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">Sales employee</span>
        <select className={inputClassName} name="sales_employee_id" defaultValue={filters.sales_employee_id}>
          <option value="">All employees</option>
          {employees.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name || user.username}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-[10rem] flex-1">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">Document number</span>
        <input
          className={inputClassName}
          name="number"
          defaultValue={filters.number}
          placeholder="SO, invoice, ATW, WS…"
        />
      </label>
      <label className="w-44">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">Status</span>
        <select className={inputClassName} name="status" defaultValue={filters.status}>
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="rounded-md bg-eq-navy px-4 py-2 text-sm font-medium text-white">
        Apply
      </button>
      <a href={action} className="rounded-md border border-eq-line px-4 py-2 text-sm font-medium text-eq-navy">
        Clear
      </a>
    </form>
  );
}
