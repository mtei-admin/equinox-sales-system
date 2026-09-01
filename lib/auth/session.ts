import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRow } from "@/types/database";

export type SessionProfile = UserRow;

export async function getSessionUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getSessionProfile(): Promise<SessionProfile | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
  return (data ?? null) as SessionProfile | null;
}
