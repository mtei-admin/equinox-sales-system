import { inputClassName } from "@/components/form-field";

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "released", label: "Released" },
  { value: "cancelled", label: "Cancelled" },
];

const TYPES = [
  { value: "all", label: "All types" },
  { value: "atw", label: "ATW" },
  { value: "dr", label: "DR" },
];

export function AtwListFilters({
  q,
  status,
  documentType,
}: {
  q: string;
  status: string;
  documentType: string;
}) {
  return (
    <form method="get" action="/atw-dr" className="flex flex-wrap items-end gap-3 border-b border-eq-line px-4 py-3">
      <label className="min-w-[12rem] flex-1">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">Search</span>
        <input className={inputClassName} name="q" defaultValue={q} placeholder="Number or customer…" />
      </label>
      <label className="w-44">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">Status</span>
        <select className={inputClassName} name="status" defaultValue={status}>
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="w-40">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">Type</span>
        <select className={inputClassName} name="document_type" defaultValue={documentType}>
          {TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="rounded-md bg-eq-navy px-4 py-2 text-sm font-medium text-white">
        Apply
      </button>
    </form>
  );
}
