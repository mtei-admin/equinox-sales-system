"use client";

import { useState } from "react";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { updateOwnProfile } from "@/lib/auth/actions";
import type { SessionProfile } from "@/lib/auth/session";

export function ProfileForm({ profile }: { profile: SessionProfile }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await updateOwnProfile(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    setMessage("Profile saved.");
    setPending(false);
  }

  return (
    <Card className="max-w-xl p-5">
      <form action={onSubmit} className="space-y-4">
        <FormField label="Full name">
          <input className={inputClassName} name="full_name" required defaultValue={profile.full_name} />
        </FormField>
        <FormField label="Username">
          <input className={inputClassName} name="username" required defaultValue={profile.username} />
        </FormField>
        <FormField label="Department">
          <input className={inputClassName} name="department" defaultValue={profile.department ?? ""} />
        </FormField>
        <p className="text-sm text-eq-slate">
          Role and status can only be changed by an administrator. Your role is{" "}
          <span className="font-medium capitalize text-eq-ink">{profile.role}</span>.
        </p>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
        <button type="submit" disabled={pending} className="rounded-md bg-eq-navy px-4 py-2 text-sm text-white">
          {pending ? "Saving…" : "Save profile"}
        </button>
      </form>
    </Card>
  );
}
