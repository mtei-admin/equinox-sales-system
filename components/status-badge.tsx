import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-sky-100 text-sky-800",
  closed: "bg-emerald-100 text-emerald-800",
  confirmed: "bg-sky-100 text-sky-800",
  posted: "bg-sky-100 text-sky-800",
  released: "bg-sky-100 text-sky-800",
  issued: "bg-emerald-100 text-emerald-800",
  invoiced: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  paid: "bg-emerald-100 text-emerald-800",
  for_approval: "bg-amber-100 text-amber-900",
  approved: "bg-sky-100 text-sky-800",
  partially_shipped: "bg-amber-100 text-amber-900",
  fully_shipped: "bg-sky-100 text-sky-800",
  partially_received: "bg-amber-100 text-amber-900",
  fully_received: "bg-emerald-100 text-emerald-800",
  in_transit: "bg-sky-100 text-sky-800",
  arrived: "bg-sky-100 text-sky-800",
  partially_invoiced: "bg-amber-100 text-amber-900",
  partially_paid: "bg-amber-100 text-amber-900",
  partially_withdrawn: "bg-amber-100 text-amber-900",
  cancelled: "bg-rose-100 text-rose-800",
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-slate-100 text-slate-600",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONES[status] ?? "bg-slate-100 text-slate-700";
  const label = status.replaceAll("_", " ");
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", tone)}>
      {label}
    </span>
  );
}
