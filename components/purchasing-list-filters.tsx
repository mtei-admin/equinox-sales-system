import { inputClassName } from "@/components/form-field";

export function PurchasingListFilters({
  action,
  q,
  status,
  from = "",
  to = "",
  statuses,
  placeholder,
}: {
  action: string;
  q: string;
  status?: string;
  from?: string;
  to?: string;
  statuses?: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3 border-b border-eq-line px-4 py-3">
      <label className="min-w-[12rem] flex-1">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">Search</span>
        <input className={inputClassName} name="q" defaultValue={q} placeholder={placeholder} />
      </label>
      {statuses ? (
        <label className="w-52">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">Status</span>
          <select className={inputClassName} name="status" defaultValue={status ?? "all"}>
            {statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="w-40">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">From</span>
        <input className={inputClassName} type="date" name="from" defaultValue={from} />
      </label>
      <label className="w-40">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">To</span>
        <input className={inputClassName} type="date" name="to" defaultValue={to} />
      </label>
      <button type="submit" className="rounded-md bg-eq-navy px-4 py-2 text-sm font-medium text-white">
        Apply
      </button>
    </form>
  );
}
