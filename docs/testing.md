# Testing

**Status:** approved (strategy). Phase 1 delivers Vitest for remaining-qty, totals, and permissions. SQL RPC tests run when local/staging Supabase is available.

## Must-have (implemented in unit tests)

- Invoice qty cannot exceed SO remaining; cancelled invoices do not consume remaining.
- Full, partial, and multiple invoices against one SO line.
- Over-invoicing and already fully invoiced SOs are rejected.
- `create_invoice` locks the SO header and lines (`FOR UPDATE`) so concurrent invoices cannot over-allocate.
- Remaining is computed per SO line (not shared across lines).
- Draft sales orders can be updated; open/cancelled/closed cannot.
- ATW qty cannot exceed invoice remaining; cancelled ATW/DR documents do not consume remaining.
- Full, partial, and multiple ATW/DR documents against one invoice.
- Over-allocation and already fully allocated invoices are rejected.
- `create_atw_document` locks the invoice header and lines (`FOR UPDATE`) so concurrent ATW/DR documents cannot over-allocate.
- Remaining is computed per invoice line (not shared across lines).
- ATW/DR requires a posted invoice. Warehouse and accounting cannot create ATW/DR.
- Withdrawal slip copies every ATW/DR line at the same quantity; partial or mismatched qty is rejected.
- Exactly one non-cancelled withdrawal slip per ATW/DR. A cancelled slip frees the ATW/DR for a replacement.
- `create_withdrawal_slip` locks the ATW header and lines (`FOR UPDATE`). Concurrent duplicate creates: one succeeds, one fails.
- Warehouse and admin write WS; sales and accounting cannot.
- Draft withdrawal slips can be edited (remarks); issued/cancelled cannot.
- Totals: amount = qty × price; invoice total_amount = amount + tax; header sums.
- Reports remaining SO qty uses non-cancelled invoice qty; remaining invoice qty uses non-cancelled ATW/DR qty; ATW awaiting a slip has no non-cancelled withdrawal slip.
- Dashboard views: admin full; sales documents + pending; warehouse ATW pending withdrawal + slips; accounting read-only overview without action links.
- Only admin may reset a user password; new password must be at least 8 characters and match confirmation.

## Must-have (SQL / staging — after `supabase db push`)

- Two concurrent invoice inserts against last remaining unit: one fails.
- Two concurrent ATW/DR inserts against last remaining invoice unit: one fails.
- Two concurrent `create_withdrawal_slip` calls for the same released ATW: one fails.
- Cancel WS then create replacement: allowed.
- Accounting `create_sales_order` RPC: rejected.

## Commands

```bash
npm run test:run
npm run lint
powershell -File scripts/validate-db.ps1
```

Do not hit production Supabase from unit tests.
