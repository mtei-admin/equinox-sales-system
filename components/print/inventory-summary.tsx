import type { InventorySummaryPrint } from "@/lib/print/inventory-summary";

export function InventorySummaryPrintView({ summary }: { summary: InventorySummaryPrint }) {
  return (
    <article className="print-sheet">
      <div className="print-letterhead" aria-hidden="true">
        Letterhead and logo
      </div>
      <header className="print-heading">
        <div>
          <h1>{summary.title}</h1>
          <p className="print-note">{summary.note}</p>
        </div>
        <dl>
          <div>
            <dt>As of</dt>
            <dd>{summary.asOf}</dd>
          </div>
          <div>
            <dt>Warehouse</dt>
            <dd>{summary.warehouseName}</dd>
          </div>
        </dl>
      </header>

      <table className="print-lines">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">On hand</th>
            <th className="num">Commited</th>
            <th className="num">Available</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {summary.lines.length === 0 ? (
            <tr>
              <td colSpan={5}>No items</td>
            </tr>
          ) : (
            summary.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <p>{line.title}</p>
                  {line.detail ? <p className="print-line-detail">{line.detail}</p> : null}
                </td>
                <td className="num">{line.onHand}</td>
                <td className="num">{line.reserved}</td>
                <td className="num">{line.available}</td>
                <td className="print-status">{line.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <dl className="print-totals">
        <div>
          <dt>On hand</dt>
          <dd>{summary.totals.onHand}</dd>
        </div>
        <div>
          <dt>Commited</dt>
          <dd>{summary.totals.reserved}</dd>
        </div>
        <div>
          <dt>Available</dt>
          <dd>{summary.totals.available}</dd>
        </div>
      </dl>
    </article>
  );
}
