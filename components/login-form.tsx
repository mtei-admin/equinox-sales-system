"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormField, inputClassName } from "@/components/form-field";
import { signIn } from "@/lib/auth/actions";
import { safeNextPath } from "@/lib/auth/routes";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNextPath(search.get("next"));
  const [error, setError] = useState<string | null>(
    search.get("error") === "inactive" ? "This account is inactive. Ask an administrator to reactivate it." : null,
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await signIn(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="mt-6 space-y-4">
      <FormField label="Email">
        <input className={inputClassName} type="email" name="email" required autoComplete="email" />
      </FormField>
      <FormField label="Password">
        <input className={inputClassName} type="password" name="password" required autoComplete="current-password" />
      </FormField>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-eq-navy py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
