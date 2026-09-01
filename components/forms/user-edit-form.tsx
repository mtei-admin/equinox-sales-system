"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/permissions/roles";
import { updateUser } from "@/lib/auth/actions";
import type { UserRow } from "@/types/database";

export function UserEditForm({ user }: { user: UserRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await updateUser(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    setMessage("User saved.");
    setPending(false);
    router.refresh();
  }

  return (
    <Card className="max-w-2xl p-5">
      <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="user_id" value={user.id} />
        <FormField label="Full name" className="sm:col-span-2">
          <input className={inputClassName} name="full_name" required defaultValue={user.full_name} />
        </FormField>
        <FormField label="Username">
          <input className={inputClassName} name="username" required defaultValue={user.username} />
        </FormField>
        <FormField label="Department">
          <input className={inputClassName} name="department" defaultValue={user.department ?? ""} />
        </FormField>
        <FormField label="Role">
          <select className={inputClassName} name="role" defaultValue={user.role}>
            {ALL_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Status">
          <select className={inputClassName} name="status" defaultValue={user.status}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FormField>
        <p className="sm:col-span-2 text-sm text-eq-slate">
          Passwords stay in Supabase Auth. Inactivate a user to block sign-in without deleting the account.
        </p>
        {error ? <p className="sm:col-span-2 text-sm text-rose-700">{error}</p> : null}
        {message ? <p className="sm:col-span-2 text-sm text-emerald-800">{message}</p> : null}
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="rounded-md bg-eq-navy px-4 py-2 text-sm text-white">
            {pending ? "Saving…" : "Save user"}
          </button>
        </div>
      </form>
    </Card>
  );
}
