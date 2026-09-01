import type { ReactNode } from "react";
import { inputClassName } from "@/components/form-field";

export function MasterListFilters({
  action,
  q,
  status,
  extra,
}: {
  action: string;
  q: string;
  status: string;
  extra?: ReactNode;
}) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3 border-b border-eq-line px-4 py-3">
      <label className="min-w-[12rem] flex-1">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">Search</span>
        <input className={inputClassName} name="q" defaultValue={q} placeholder="Search…" />
      </label>
      <label className="w-40">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">Status</span>
        <select className={inputClassName} name="status" defaultValue={status}>
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      {extra}
      <button type="submit" className="rounded-md bg-eq-navy px-4 py-2 text-sm font-medium text-white">
        Apply
      </button>
    </form>
  );
}
