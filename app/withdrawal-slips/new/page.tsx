import { Card, PageHeader } from "@/components/page-header";
import { AtwLookupSearch } from "@/components/atw-lookup-search";
import { WithdrawalSlipForm } from "@/components/forms/withdrawal-slip-form";
import { searchReleasedAtw } from "@/lib/data/queries";
import { loadWsSource } from "@/lib/withdrawal-slips/actions";
import { requirePermission } from "@/lib/auth/guards";
import { formatQty } from "@/lib/utils";

export default async function NewWithdrawalSlipPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("withdrawal-slips.write");
  const params = await searchParams;
  const q = Array.isArray(params.q) ? (params.q[0] ?? "") : (params.q ?? "");
  const requested = Array.isArray(params.atw_id) ? params.atw_id[0] : params.atw_id;
  const matches = q.trim() ? await searchReleasedAtw(q) : [];
  const source = requested ? await loadWsSource(requested) : null;

  return (
    <>
      <PageHeader
        title="New withdrawal slip"
        description="Search by ATW ID, ATW number, or DR number. Load the document, then save a draft that copies every line."
      />
      <Card className="p-5">
        <AtwLookupSearch q={q} />
        {!q.trim() && !requested ? (
          <p className="mt-4 text-sm text-eq-slate">Search for a released ATW or Delivery Receipt to load its lines.</p>
        ) : null}
        {q.trim() && matches.length === 0 ? (
          <p className="mt-4 text-sm text-eq-slate">No released ATW/DR matched that ID or number.</p>
        ) : null}
        {matches.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-eq-slate">
                <tr>
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((row) => (
                  <tr key={row.id} className="border-t border-eq-line">
                    <td className="py-2 pr-3 font-mono text-xs">
                      <a className="text-eq-navy underline" href={`/withdrawal-slips/new?q=${encodeURIComponent(q)}&atw_id=${row.id}`}>
                        {row.atw_number}
                      </a>
                    </td>
                    <td className="py-2 pr-3 uppercase">{row.document_type}</td>
                    <td className="py-2 pr-3">{row.customer_name}</td>
                    <td className="py-2 pr-3">{formatQty(row.total_quantity)}</td>
                    <td className="py-2">
                      {row.has_active_slip ? (
                        <a className="text-rose-700 underline" href={`/withdrawal-slips/${row.active_withdrawal_slip_id}`}>
                          Already has a slip
                        </a>
                      ) : (
                        <a className="text-eq-navy underline" href={`/withdrawal-slips/new?q=${encodeURIComponent(q)}&atw_id=${row.id}`}>
                          Load
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
      {source && !source.ok ? (
        <Card className="mt-4 p-5">
          <p className="text-sm text-rose-700">{source.error}</p>
          {source.existingId ? (
            <p className="mt-2 text-sm">
              <a className="text-eq-navy underline" href={`/withdrawal-slips/${source.existingId}`}>
                Open the existing withdrawal slip
              </a>
            </p>
          ) : null}
        </Card>
      ) : null}
      {source && source.ok ? (
        <div className="mt-4">
          <WithdrawalSlipForm
            atwId={source.atw_id}
            atwNumber={source.atw_number}
            documentType={source.document_type}
            customerName={source.customer_name}
            lines={source.lines}
          />
        </div>
      ) : null}
    </>
  );
}
