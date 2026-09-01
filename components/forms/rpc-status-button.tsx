"use client";

import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function RpcStatusButton({ fn, id, label }: { fn: string; id: string; label: string }) {
  const router = useRouter();

  return (
    <ConfirmDialog
      title={label}
      description="This status change is recorded in the database and cannot be undone except by cancel."
      confirmLabel={label}
      onConfirm={async () => {
        const supabase = createBrowserSupabaseClient();
        const { error } = await supabase.rpc(fn, { p_id: id });
        if (error) throw error;
        router.refresh();
      }}
    >
      {(open) => (
        <button type="button" onClick={open} className="rounded-md bg-eq-navy px-3.5 py-2 text-sm text-white">
          {label}
        </button>
      )}
    </ConfirmDialog>
  );
}
