import type { ReactNode } from "react";
import { can, type Permission } from "@/lib/permissions/policies";
import { getSessionProfile } from "@/lib/auth/session";

export async function Can({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const profile = await getSessionProfile();
  if (!profile || profile.status !== "active" || !can(profile.role, permission)) {
    return null;
  }
  return children;
}
