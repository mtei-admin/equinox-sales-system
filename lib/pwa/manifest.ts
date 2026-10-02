import type { MetadataRoute } from "next";

export const equinoxManifest: MetadataRoute.Manifest = {
  name: "Equinox Sales System",
  short_name: "Equinox",
  description: "Sales orders, invoices, ATW/DR, and warehouse withdrawals",
  start_url: "/dashboard",
  scope: "/",
  display: "standalone",
  background_color: "#eef3f7",
  theme_color: "#12344d",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
