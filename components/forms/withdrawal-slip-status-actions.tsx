"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { inputClassName } from "@/components/form-field";
import { cancelWithdrawalSlipAction, issueWithdrawalSlipAction } from "@/lib/withdrawal-slips/actions";

export function IssueWithdrawalSlipButton({ id }: { id: string }) {
  const router = useRouter();

  return (
    <ConfirmDialog
      title="Issue withdrawal slip"
      description="Issued slips are the warehouse record of the pick. The ATW/DR still cannot have a second active slip."
      confirmLabel="Issue slip"
      onConfirm={async () => {
        const formData = new FormData();
        formData.set("id", id);
        const result = await issueWithdrawalSlipAction(formData);
        if (!result.ok) throw new Error(result.error);
        router.refresh();
      }}
    >
      {(open) => (
        <button type="button" onClick={open} className="rounded-md bg-eq-navy px-3.5 py-2 text-sm text-white">
          Issue slip
        </button>
      )}
    </ConfirmDialog>
  );
}

export function CancelWithdrawalSlipButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("id", id);
    formData.set("reason", reason);
    const result = await cancelWithdrawalSlipAction(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-rose-200 px-3.5 py-2 text-sm text-rose-800 hover:bg-rose-50"
      >
        Cancel slip
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eq-ink/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-eq-ink">Cancel withdrawal slip</h2>
            <p className="mt-2 text-sm text-eq-slate">
              Cancelling frees the ATW/DR so a replacement slip can be created. This does not delete history.
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-eq-navy">Reason</span>
              <textarea className={inputClassName} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-eq-line px-3 py-2 text-sm" onClick={() => setOpen(false)} disabled={pending}>
                Back
              </button>
              <button type="button" className="rounded-md bg-rose-700 px-3 py-2 text-sm text-white disabled:opacity-60" onClick={confirm} disabled={pending}>
                {pending ? "Cancelling…" : "Cancel slip"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
