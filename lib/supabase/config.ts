function readEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY") {
  return (process.env[name] ?? "").trim();
}

export function isSupabaseConfigured() {
  return Boolean(readEnv("NEXT_PUBLIC_SUPABASE_URL") && readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
}

export function isAdminConfigured() {
  return Boolean(readEnv("NEXT_PUBLIC_SUPABASE_URL") && readEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export function adminEnvError() {
  const missing = [
    !readEnv("NEXT_PUBLIC_SUPABASE_URL") ? "NEXT_PUBLIC_SUPABASE_URL" : null,
    !readEnv("SUPABASE_SERVICE_ROLE_KEY") ? "SUPABASE_SERVICE_ROLE_KEY" : null,
  ].filter((name): name is string => Boolean(name));
  return `Missing ${missing.join(" and ")}. Add it in Vercel Settings → Environment Variables (or .env.local), then redeploy or restart the app.`;
}
