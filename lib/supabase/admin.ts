import { createClient } from "@supabase/supabase-js";
import { adminEnvError, isAdminConfigured } from "@/lib/supabase/config";

export function createAdminClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!isAdminConfigured() || !url || !serviceKey) {
    throw new Error(adminEnvError());
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
