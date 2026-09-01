"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ModuleKey } from "@/types";
import { canAccessModule } from "@/lib/permissions/policies";
import type { UserRole } from "@/types/database";
import {
  ClipboardList,
  LayoutDashboard,
  Package,
  Receipt,
  Truck,
  Users,
  UserCog,
  BarChart3,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; module: ModuleKey; icon: typeof LayoutDashboard }[] = [
  { href: "/dashboard", label: "Dashboard", module: "dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", module: "customers", icon: Users },
  { href: "/items", label: "Items", module: "items", icon: Package },
  { href: "/sales-orders", label: "Sales orders", module: "sales-orders", icon: ClipboardList },
  { href: "/invoices", label: "Invoices", module: "invoices", icon: Receipt },
  { href: "/atw-dr", label: "ATW / DR", module: "atw-dr", icon: Truck },
  { href: "/withdrawal-slips", label: "Withdrawal slips", module: "withdrawal-slips", icon: Warehouse },
  { href: "/reports", label: "Reports", module: "reports", icon: BarChart3 },
  { href: "/users", label: "Users", module: "users", icon: UserCog },
];

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => canAccessModule(role, item.module));

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-eq-ink text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-eq-amber">Equinox</p>
        <p className="mt-1 text-lg font-semibold">Sales System</p>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="px-5 py-4 text-xs text-white/40">Order → Invoice → ATW → Withdrawal</p>
    </aside>
  );
}

export function Header({ name, role }: { name: string; role: string }) {
  return (
    <header className="flex items-center justify-between border-b border-eq-line bg-white px-6 py-3">
      <p className="text-sm text-eq-slate">Equinox operations</p>
      <form action="/api/auth/sign-out" method="post" className="flex items-center gap-3">
        <Link href="/profile" className="text-right hover:opacity-80">
          <p className="text-sm font-medium text-eq-ink">{name}</p>
          <p className="text-xs capitalize text-eq-slate">{role}</p>
        </Link>
        <button type="submit" className="rounded-md border border-eq-line px-3 py-1.5 text-xs font-medium text-eq-navy">
          Sign out
        </button>
      </form>
    </header>
  );
}
