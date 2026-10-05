# Implementation plan

**Status:** Phase 0 complete (proposals accepted 2026-09-01). Phases 1–10 complete through inventory and browser print. Playwright and Vercel remain later.

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
| 10 | Browser print for Invoice, ATW/DR, and Withdrawal Slip | done |
| 11 | Purchasing: suppliers, purchase orders, bills of lading, receiving reports, inventory receipt | done |
| 12 | Playwright, Vercel, deployment refresh | not started |

v1 out of scope: payments, official letterhead and logo, separate ATW/DR tables, multiple active WS per ATW, warehouse picker.

## Engineering

Do not invent requirements. Do not edit applied migrations. Quantity rules live in RPCs + `lib/business`. Ask if a new ambiguity affects integrity.
