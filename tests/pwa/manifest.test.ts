import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/auth/routes";
import { equinoxManifest } from "@/lib/pwa/manifest";

describe("PWA manifest", () => {
  it("is installable and opens the dashboard", () => {
    expect(equinoxManifest.name).toBe("Equinox Sales System");
    expect(equinoxManifest.short_name).toBe("Equinox");
    expect(equinoxManifest.display).toBe("standalone");
    expect(equinoxManifest.start_url).toBe("/dashboard");
    expect(equinoxManifest.icons?.map((icon) => icon.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
  });

  it("keeps the manifest, service worker, and offline page public", () => {
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPublicPath("/sw.js")).toBe(true);
    expect(isPublicPath("/offline")).toBe(true);
  });

  it("does not cache API responses", () => {
    const worker = readFileSync("public/sw.js", "utf8");
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain("return;");
    expect(worker).toContain('pathname.startsWith("/icons/")');
  });
});