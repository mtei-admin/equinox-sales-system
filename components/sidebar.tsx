"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { ModuleKey } from "@/types";
import { canAccessModule } from "@/lib/permissions/policies";
import type { UserRole } from "@/types/database";
import {
  ClipboardList,
  LayoutDashboard,
  Menu,
  Package,
  Receipt,
  Truck,
  Users,
  UserCog,
  BarChart3,
  Boxes,
  ClipboardPen,
  Warehouse,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; module: ModuleKey; icon: typeof LayoutDashboard };
type NavGroup = { id: string; label: string | null; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    id: "dashboard",
    label: null,
    items: [{ href: "/dashboard", label: "Dashboard", module: "dashboard", icon: LayoutDashboard }],
  },
  {
    id: "master-data",
    label: "Master Data",
    items: [
      { href: "/customers", label: "Customers", module: "customers", icon: Users },
      { href: "/items", label: "Items", module: "items", icon: Package },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      { href: "/sales-orders", label: "Sales orders", module: "sales-orders", icon: ClipboardList },
      { href: "/invoices", label: "Invoices", module: "invoices", icon: Receipt },
      { href: "/atw-dr", label: "ATW / DR", module: "atw-dr", icon: Truck },
      { href: "/withdrawal-slips", label: "Withdrawal slips", module: "withdrawal-slips", icon: Warehouse },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    items: [
      { href: "/inventory", label: "Stock on hand", module: "inventory", icon: Boxes },
      { href: "/inventory/adjustments", label: "Adjustments", module: "inventory", icon: ClipboardPen },
    ],
  },
  {
    id: "reports",
    label: null,
    items: [{ href: "/reports", label: "Reports", module: "reports", icon: BarChart3 }],
  },
  {
    id: "users",
    label: null,
    items: [{ href: "/users", label: "Users", module: "users", icon: UserCog }],
  },
];

export function AppShellNav({
  role,
  name,
  children,
}: {
  role: UserRole;
  name: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-screen">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <Sidebar role={role} open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header name={name} role={role} onOpenMenu={() => setOpen(true)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({
  role,
  open,
  onClose,
}: {
  role: UserRole;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessModule(role, item.module)),
  })).filter((group) => group.items.length > 0);
  const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-eq-ink text-white transition-transform duration-200 md:static md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex items-start justify-between border-b border-white/10 px-5 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-eq-amber">Equinox</p>
          <p className="mt-1 text-lg font-semibold">Sales System</p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white md:hidden"
          aria-label="Close menu"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {groups.map((group) => (
          <div key={group.id} className="space-y-0.5">
            {group.label ? (
              <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                {group.label}
              </p>
            ) : null}
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (pathname.startsWith(`${item.href}/`) &&
                  !hrefs.some(
                    (other) =>
                      other !== item.href &&
                      other.length > item.href.length &&
                      (pathname === other || pathname.startsWith(`${other}/`)),
                  ));
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
          </div>
        ))}
      </nav>
      <p className="px-5 py-4 text-xs text-white/40">Order → Invoice → ATW → Withdrawal</p>
    </aside>
  );
}

function Header({
  name,
  role,
  onOpenMenu,
}: {
  name: string;
  role: string;
  onOpenMenu: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-eq-line bg-white px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="rounded-md border border-eq-line p-2 text-eq-navy hover:bg-eq-mist md:hidden"
          aria-label="Open menu"
          onClick={onOpenMenu}
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="truncate text-sm text-eq-slate">Equinox operations</p>
      </div>
      <form action="/api/auth/sign-out" method="post" className="flex shrink-0 items-center gap-3">
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
