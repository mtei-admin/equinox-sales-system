import type { ReactNode } from "react";
import { Header, Sidebar } from "@/components/sidebar";
import type { SessionProfile } from "@/lib/auth/session";

export function AppShell({
  profile,
  children,
}: {
  profile: SessionProfile;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar role={profile.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header name={profile.full_name || profile.username} role={profile.role} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
