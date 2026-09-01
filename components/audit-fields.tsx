import { formatDateTime } from "@/lib/utils";

export function AuditFields({
  createdAt,
  createdByName,
  updatedAt,
  updatedByName,
  cancelledAt,
  cancelledByName,
  cancellationReason,
}: {
  createdAt: string;
  createdByName: string | null;
  updatedAt: string;
  updatedByName: string | null;
  cancelledAt?: string | null;
  cancelledByName?: string | null;
  cancellationReason?: string | null;
}) {
  return (
    <dl className="mt-6 grid gap-4 border-t border-eq-line pt-4 sm:grid-cols-2">
      <div>
        <dt className="text-xs uppercase tracking-wide text-eq-slate">Created</dt>
        <dd className="mt-1 text-sm text-eq-ink">{formatDateTime(createdAt)}</dd>
        <dd className="text-xs text-eq-slate">{createdByName ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-eq-slate">Last updated</dt>
        <dd className="mt-1 text-sm text-eq-ink">{formatDateTime(updatedAt)}</dd>
        <dd className="text-xs text-eq-slate">{updatedByName ?? "—"}</dd>
      </div>
      {cancelledAt ? (
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-eq-slate">Cancelled</dt>
          <dd className="mt-1 text-sm text-eq-ink">{formatDateTime(cancelledAt)}</dd>
          <dd className="text-xs text-eq-slate">{cancelledByName ?? "—"}</dd>
          {cancellationReason ? <dd className="mt-1 text-sm text-eq-slate">{cancellationReason}</dd> : null}
        </div>
      ) : null}
    </dl>
  );
}
