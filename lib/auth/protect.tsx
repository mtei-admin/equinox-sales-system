import type { ReactNode } from "react";
import { requirePermission, requireProfile } from "@/lib/auth/guards";
import type { Permission } from "@/lib/permissions/policies";

export function protect(permission: Permission) {
  return async function ProtectedLayout({ children }: { children: ReactNode }) {
    await requirePermission(permission);
    return children;
  };
}

export function protectAuthenticated() {
  return async function AuthenticatedLayout({ children }: { children: ReactNode }) {
    await requireProfile();
    return children;
  };
}
