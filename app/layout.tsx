import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { isPrintPath, isPublicPath } from "@/lib/auth/routes";
import { getSessionProfile } from "@/lib/auth/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Equinox Sales System",
  description: "Sales orders, invoices, ATW/DR, and warehouse withdrawals",
  applicationName: "Equinox",
  appleWebApp: {
    capable: true,
    title: "Equinox",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#12344d",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isPublic = isPublicPath(pathname) || pathname.startsWith("/api/");
  const printView = isPrintPath(pathname);
  const profile = isPublic ? null : await getSessionProfile();

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <RegisterServiceWorker />
        {profile && profile.status === "active" && !isPublic && !printView ? (
          <AppShell profile={profile}>{children}</AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
