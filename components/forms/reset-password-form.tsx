"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { resetUserPassword } from "@/lib/auth/actions";

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await resetUserPassword(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    setMessage("Password updated. The user can sign in with the new password immediately.");
    setPending(false);
    formRef.current?.reset();
  }

  return (
    <Card className="mt-4 max-w-2xl p-5">
      <h2 className="text-sm font-semibold text-eq-ink">Reset password</h2>
      <p className="mt-1 text-sm text-eq-slate">
        Sets a new password in Supabase Auth. The current password is replaced; it is not emailed.
      </p>
      <form ref={formRef} action={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="user_id" value={userId} />
        <FormField label="New password">
          <input className={inputClassName} name="password" type="password" minLength={8} required autoComplete="new-password" />
        </FormField>
        <FormField label="Confirm password">
          <input
            className={inputClassName}
            name="confirm_password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </FormField>
        {error ? <p className="sm:col-span-2 text-sm text-rose-700">{error}</p> : null}
        {message ? <p className="sm:col-span-2 text-sm text-emerald-800">{message}</p> : null}
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="rounded-md bg-eq-navy px-4 py-2 text-sm text-white">
            {pending ? "Updating…" : "Reset password"}
          </button>
        </div>
      </form>
    </Card>
  );
}
