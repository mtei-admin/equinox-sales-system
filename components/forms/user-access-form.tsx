"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClassName } from "@/components/form-field";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/permissions/roles";
import { updateUserAccess } from "@/lib/auth/actions";
import type { UserRow } from "@/types/database";

export function UserAccessForm({ user }: { user: UserRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await updateUserAccess(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    setPending(false);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={user.id} />
      <select className={inputClassName} name="role" defaultValue={user.role} aria-label={`Role for ${user.username}`}>
        {ALL_ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      <select className={inputClassName} name="status" defaultValue={user.status} aria-label={`Status for ${user.username}`}>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <button type="submit" disabled={pending} className="rounded-md border border-eq-line px-3 py-2 text-xs font-medium text-eq-navy">
        {pending ? "Saving…" : "Update"}
      </button>
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
    </form>
  );
}
