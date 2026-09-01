import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-eq-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-eq-slate">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-md bg-eq-navy px-3.5 py-2 text-sm font-medium text-white hover:bg-eq-ink"
    >
      {children}
    </a>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-md border border-eq-line bg-white px-3.5 py-2 text-sm font-medium text-eq-navy hover:bg-eq-mist"
    >
      {children}
    </a>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-eq-line bg-white shadow-sm", className)}>{children}</div>
  );
}
