import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  children,
  error,
  className,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-eq-navy">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}

export const inputClassName =
  "w-full rounded-md border border-eq-line bg-white px-3 py-2 text-sm text-eq-ink outline-none ring-eq-amber/40 focus:border-eq-navy focus:ring-2";
