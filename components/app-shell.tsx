import type { ReactNode } from "react";
import { AppShellNav } from "@/components/sidebar";
import type { SessionProfile } from "@/lib/auth/session";

export function AppShell({
  profile,
  children,
}: {
  profile: SessionProfile;
  children: ReactNode;
}) {
  return (
    <AppShellNav role={profile.role} name={profile.full_name || profile.username}>
      {children}
    </AppShellNav>
  );
}
