"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { inputClassName } from "@/components/form-field";
import { billOfLadingAction, purchaseOrderAction, receivingReportAction, resolveDiscrepancy } from "@/lib/purchasing/actions";

function useRefresh() {
  const router = useRouter();
  return () => router.refresh();
}

export function PurchaseOrderButton({ id, action, label, title, description }: {
  id: string;
  action: "submit" | "approve" | "close";
  label: string;
  title: string;
  description: string;
}) {
  const refresh = useRefresh();
  return (
    <ConfirmDialog
      title={title}
      description={description}
      confirmLabel={label}
      onConfirm={async () => {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("action", action);
        const result = await purchaseOrderAction(formData);
        if (!result.ok) throw new Error(result.error);
        refresh();
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

export function BillOfLadingButton({ id, action, label, title, description }: {
  id: string;
  action: "post" | "transit" | "arrived";
  label: string;
  title: string;
  description: string;
}) {
  const refresh = useRefresh();
  return (
    <ConfirmDialog
      title={title}
      description={description}
      confirmLabel={label}
      onConfirm={async () => {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("action", action);
        const result = await billOfLadingAction(formData);
        if (!result.ok) throw new Error(result.error);
        refresh();
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

export function PostReceivingButton({ id }: { id: string }) {
  const refresh = useRefresh();
  return (
    <ConfirmDialog
      title="Post receiving report"
      description="Posting adds good quantity to stock on hand and locks this report. Damaged quantity is recorded and is not usable stock."
      confirmLabel="Post receiving report"
      onConfirm={async () => {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("action", "post");
        const result = await receivingReportAction(formData);
        if (!result.ok) throw new Error(result.error);
        refresh();
      }}
    >
      {(open) => (
        <button type="button" onClick={open} className="rounded-md bg-eq-navy px-3.5 py-2 text-sm text-white">
          Post receiving report
        </button>
      )}
    </ConfirmDialog>
  );
}

export function CancelPurchasingButton({
  id,
  kind,
}: {
  id: string;
  kind: "purchase-order" | "bill-of-lading" | "receiving-report";
}) {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("id", id);
    formData.set("action", "cancel");
    formData.set("reason", reason);
    const result =
      kind === "purchase-order"
        ? await purchaseOrderAction(formData)
        : kind === "bill-of-lading"
          ? await billOfLadingAction(formData)
          : await receivingReportAction(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    setOpen(false);
    refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-eq-line px-3.5 py-2 text-sm">
        Cancel
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eq-ink/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Cancel document</h2>
            <p className="mt-1 text-sm text-eq-slate">A reason is required. Posted receiving reports reverse good quantity and keep the original movement.</p>
            <textarea className={`${inputClassName} mt-3`} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
            {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-eq-line px-3 py-2 text-sm" onClick={() => setOpen(false)}>Close</button>
              <button type="button" disabled={pending || !reason.trim()} className="rounded-md bg-eq-navy px-3 py-2 text-sm text-white disabled:opacity-60" onClick={onConfirm}>
                {pending ? "Cancelling..." : "Cancel document"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ResolveDiscrepancyForm({ id, reportId }: { id: string; reportId: string }) {
  const refresh = useRefresh();
  const [status, setStatus] = useState("accepted");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("id", id);
    formData.set("report_id", reportId);
    formData.set("status", status);
    formData.set("remarks", remarks);
    const result = await resolveDiscrepancy(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    refresh();
  }

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
      <select className={inputClassName} value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="accepted">Accepted</option>
        <option value="for_claim">For claim</option>
        <option value="replacement_expected">Replacement expected</option>
        <option value="rejected">Rejected</option>
        <option value="resolved">Resolved</option>
      </select>
      <input className={inputClassName} placeholder="Resolution remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
      <button type="button" disabled={pending} className="rounded-md border border-eq-line px-3 py-2 text-sm" onClick={onSubmit}>
        {pending ? "Saving..." : "Resolve"}
      </button>
      {error ? <p className="sm:col-span-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
