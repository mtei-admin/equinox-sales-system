import { afterEach, describe, expect, it } from "vitest";
import { adminEnvError, isAdminConfigured } from "@/lib/supabase/config";

const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

describe("admin env", () => {
  const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it("requires the project URL and service role key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    expect(isAdminConfigured()).toBe(true);
  });

  it("names the missing service role key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(isAdminConfigured()).toBe(false);
    expect(adminEnvError()).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(adminEnvError()).not.toContain("NEXT_PUBLIC_SUPABASE_URL and");
  });
});
