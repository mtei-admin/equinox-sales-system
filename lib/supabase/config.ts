function readPublicEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
  return (process.env[name] ?? "").trim();
}

export function isSupabaseConfigured() {
  return Boolean(readPublicEnv("NEXT_PUBLIC_SUPABASE_URL") && readPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
}
