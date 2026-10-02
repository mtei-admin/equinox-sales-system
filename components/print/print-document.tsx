import type { PrintDocument } from "@/lib/print/documents";

export function PrintDocumentView({ document }: { document: PrintDocument }) {
  return (
    <article className="print-sheet">
      {document.cancelled ? <p className="print-stamp">Cancelled</p> : null}
      <div className="print-letterhead" aria-hidden="true">
        Letterhead and logo
      </div>
      <header className="print-heading">
        <div>
          <h1>{document.title}</h1>
          {document.note ? <p className="print-note">{document.note}</p> : null}
        </div>
        <dl>
          <div>
            <dt>Number</dt>
            <dd>{document.number}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{document.date}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd className="print-status">{document.status}</dd>
          </div>
        </dl>
      </header>

      {document.cancelled ? (
        <p className="print-cancelled">
          Cancelled{document.cancellationReason ? ` — ${document.cancellationReason}` : ""}
        </p>
      ) : null}

      <section className="print-parties">
        <div>
          <h2>Customer</h2>
          <p>{document.customerName}</p>
        </div>
        <div>
          <h2>Delivery address</h2>
          <p>{document.deliveryAddress}</p>
        </div>
      </section>

      <dl className="print-meta">
        {document.meta.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>

      <table className="print-lines">
        <thead>
          <tr>
            {document.columns.map((column) => (
              <th key={column} className={column === "Item" ? "" : "num"}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {document.lines.map((line) => (
            <tr key={line.id}>
              <td>
                <p>{line.title}</p>
                {line.detail ? <p className="print-line-detail">{line.detail}</p> : null}
              </td>
              {line.values.map((value, index) => (
                <td key={`${line.id}-${index}`} className="num">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="print-totals">
        <div>
          <dt>Total quantity</dt>
          <dd>{document.totalQuantity}</dd>
        </div>
        <div>
          <dt>Grand total</dt>
          <dd>{document.grandTotal}</dd>
        </div>
      </dl>

      {document.remarks ? (
        <section className="print-remarks">
          <h2>Remarks</h2>
          <p>{document.remarks}</p>
        </section>
      ) : null}

      <section className="print-sign">
        <div>
          <p>Prepared by</p>
          <span>{document.preparedBy ?? ""}</span>
        </div>
        <div>
          <p>Received by</p>
          <span />
        </div>
      </section>
    </article>
  );
}
