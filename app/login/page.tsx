import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="flex min-h-screen items-center justify-center bg-eq-ink px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-eq-amber">Equinox</p>
        <h1 className="mt-2 text-2xl font-semibold text-eq-ink">Sales System</h1>
        <p className="mt-1 text-sm text-eq-slate">Sign in with your Equinox account. Access is based on your role.</p>
        {configured ? (
          <Suspense fallback={<p className="mt-6 text-sm text-eq-slate">Loading…</p>}>
            <LoginForm />
          </Suspense>
        ) : (
          <p className="mt-6 rounded-md bg-eq-mist p-3 text-sm text-eq-slate">
            Configure <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
            <code className="font-mono">.env.local</code> from <code className="font-mono">.env.example</code>, then
            apply <code className="font-mono">supabase/migrations</code>. Sign-up is disabled; an administrator invites
            users.
          </p>
        )}
      </div>
    </div>
  );
}
