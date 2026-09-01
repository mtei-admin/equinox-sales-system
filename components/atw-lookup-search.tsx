import { inputClassName } from "@/components/form-field";

export function AtwLookupSearch({ q }: { q: string }) {
  return (
    <form method="get" action="/withdrawal-slips/new" className="flex flex-wrap items-end gap-3">
      <label className="min-w-[16rem] flex-1">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">
          ATW ID, ATW number, or DR number
        </span>
        <input
          className={inputClassName}
          name="q"
          defaultValue={q}
          placeholder="UUID, ATW-2026-0001…"
        />
      </label>
      <button type="submit" className="rounded-md bg-eq-navy px-4 py-2 text-sm font-medium text-white">
        Search
      </button>
    </form>
  );
}
