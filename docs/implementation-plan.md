# Implementation plan

**Status:** Phase 0 complete (proposals accepted 2026-09-01). Phases 1–8 dashboard and reports complete (schema, auth, master data, sales orders, invoices, ATW/DR, withdrawal slips, role dashboards / D19). Playwright and Vercel remain later.

## Phases

| Phase | Work | Status |
| --- | --- | --- |
| 0 | Spec + decisions | done |
| 1 | Replace prototype schema, RLS, RPCs, unit tests, permission matrix | done |
| 2 | Auth / authorization | done |
| 3 | Master data (customers, items, users) | done |
| 4 | Sales Order UI + SO → invoice remaining qty | done |
| 5 | Invoice UI (manual InvoiceNumber, remaining qty errors) | done |
| 6 | ATW/DR UI | done |
| 7 | Withdrawal Slip UI | done |
| 8 | Dashboard and reports (D19) | done |
| 9 | Inventory (on-hand / reserved / available, adjustments) | done |
| 10 | Playwright, Vercel, deployment refresh | not started |

v1 out of scope: payments, print templates, separate ATW/DR tables, multiple active WS per ATW, warehouse picker.

## Engineering

Do not invent requirements. Do not edit applied migrations. Quantity rules live in RPCs + `lib/business`. Ask if a new ambiguity affects integrity.
