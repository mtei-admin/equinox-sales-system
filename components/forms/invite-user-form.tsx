"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/permissions/roles";
import { inviteUser } from "@/lib/auth/actions";

export function InviteUserForm({ configured = true }: { configured?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await inviteUser(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    setMessage("User created. They can sign in immediately.");
    setPending(false);
    router.refresh();
  }

  return (
    <Card className="h-fit p-5">
      <h2 className="text-sm font-semibold text-eq-ink">Invite user</h2>
      <p className="mt-1 text-xs text-eq-slate">Creates a Supabase Auth user and an Equinox profile. No public sign-up.</p>
      <form action={onSubmit} className="mt-4 space-y-3">
        <FormField label="Full name">
          <input className={inputClassName} name="full_name" required />
        </FormField>
        <FormField label="Username">
          <input className={inputClassName} name="username" required minLength={2} />
        </FormField>
        <FormField label="Department">
          <input className={inputClassName} name="department" />
        </FormField>
        <FormField label="Email">
          <input className={inputClassName} name="email" type="email" required />
        </FormField>
        <FormField label="Temporary password">
          <input className={inputClassName} name="password" type="password" minLength={8} required />
        </FormField>
        <FormField label="Role">
          <select className={inputClassName} name="role" defaultValue="accounting">
            {ALL_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </FormField>
        {!configured ? (
          <p className="text-sm text-rose-700">
            Missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel Settings → Environment Variables (or .env.local), then
            redeploy or restart.
          </p>
        ) : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
        <button
          type="submit"
          disabled={pending || !configured}
          className="w-full rounded-md bg-eq-navy py-2 text-sm text-white"
        >
          {pending ? "Creating…" : "Create user"}
        </button>
      </form>
    </Card>
  );
}
