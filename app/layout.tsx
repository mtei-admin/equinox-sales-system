import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { isPublicPath } from "@/lib/auth/routes";
import { getSessionProfile } from "@/lib/auth/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Equinox Sales System",
  description: "Sales orders, invoices, ATW/DR, and warehouse withdrawals",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isPublic = isPublicPath(pathname) || pathname.startsWith("/api/");
  const profile = isPublic ? null : await getSessionProfile();

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {profile && profile.status === "active" && !isPublic ? (
          <AppShell profile={profile}>{children}</AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
