# Architecture

**Document status:** approved for implementation (user accepted all proposals on 2026-09-01).  
**Current phase:** Phase 8 — Dashboard and reports. Playwright and Vercel remain later.

This specification supersedes the prototype in `supabase/migrations/20240901000000_init.sql`. A **new** migration replaces those objects. Do not edit the old migration file.

## Confirmed requirements

Document chain:

```
Sales Order → Invoice → ATW / Delivery Receipt → Withdrawal Slip
```

| Parent | Child | Cardinality |
| --- | --- | --- |
| Sales Order | Invoice | one to many |
| Invoice | ATW/DR | one to many |
| ATW/DR | Withdrawal Slip | one to **zero or one** active slip |

Lineage: Item master → SO item → Invoice item → ATW item → WS item.

Stack: Next.js App Router, React, TypeScript strict, Tailwind CSS, Zod, Supabase (PostgreSQL, Auth, RLS), Git/GitHub. Vercel + Supabase Cloud.

Auth: Supabase Auth only. No plaintext passwords.

ATW and DR: one table, `document_type` (`atw` | `dr`).

Invoice numbers: typed from pre-printed stock, not generated.

Quantity remaining and one active WS per ATW: enforced in Postgres (row locks + partial unique index), not only the UI.

## Approved decisions (D1–D24)

| ID | Decision |
| --- | --- |
| D1 | Statuses below. Cancel = status change + `cancelled_by` / `cancelled_at` / `cancellation_reason`, no physical delete. Who may cancel: **admin**, or the role that can write that document, and only if no **non-cancelled** child documents exist. |
| D2 | Admin: full master data. Sales: create/edit Customers and Items. Warehouse and Accounting: read master data. |
| D3 | `Permission` is the role enum: `admin` \| `sales` \| `warehouse` \| `accounting`. No per-screen ACL in v1. |
| D4 | `department` is free text. |
| D5 | `sales_employee_id` → `users.id`, plus `sales_employee_name` snapshot on each document. |
| D6 | PK `id uuid`. Human SO number `SO-YYYY-NNNN`. ATW/WS numbers system-generated the same way. Invoice uses typed `invoice_number` only. Customers and Items: UUID only (no extra code). |
| D7 | **Catalog item.** One master row per model. Serial/barcode on the **line** (default copied from master, editable on the SO line). |
| D8 | UOM and unit price entered on the Sales Order line; copied down the chain. |
| D9 | `Amount = Quantity × UnitPrice`. Invoice `TotalAmount = Amount + TaxAmount`. SO/ATW/WS line `TotalAmount = Amount` (tax 0). Header `GrandTotal` = sum of line `TotalAmount`. Header `TotalQuantity` = sum of line quantities. |
| D10 | No system tax rate. Tax amount is typed on the **invoice line**. TIN stored on customer only; no TIN validation in v1. |
| D11 | ATW line has `quantity` (this ATW) plus snapshot `invoice_item_quantity`. ATW qty ≤ invoice remaining. |
| D12 | WS **line** has `quantity` only (no line `TotalQuantity`). Header still has `total_quantity` and `grand_total`. |
| D13 | Creating a WS copies **all** ATW lines at the same quantities. No partial WS. |
| D14 | `invoice_number` unique among invoices with status ≠ `cancelled`. Cancelled numbers may be reused. Uniqueness is global (not per year). |
| D15 | `order_type` and `term` are free text in v1. |
| D16 | SO `delivery_address` defaults from customer `billing_address`, then snapshot; user may edit on the SO. |
| D17 | Inventory: movement ledger. On-hand = sum of movements. Reserved = open/closed SO qty not yet issued. Available = on-hand − reserved. Stock leaves on **WS issued**. Stock increases on a **posted receiving report** (good qty only). Adjustments are documents. One warehouse now (`warehouse_id` for later locations). |
| D18 | Payments, AR, credit limit: **out of scope**. |
| D19 | v1 reports: remaining SO qty, remaining invoice qty, ATW without a non-cancelled WS. |
| D20 | **One non-cancelled WS per ATW.** Partial unique index on `withdrawal_slips(atw_id) WHERE status <> 'cancelled'`. Cancelling a WS frees the ATW for a replacement slip. |
| D21 | New migration replaces prototype objects. Do not edit `20240901000000_init.sql`. |
| D22 | `timestamptz` in UTC in the database; display `Asia/Manila`. Document business dates are `date`. |
| D23 | Browser print of Invoice, ATW/DR, and Withdrawal Slip from stored snapshots, plus the current inventory summary (on-hand, reserved, available). Same read permission as the screen. Letterhead and logo are reserved and not yet supplied. |
| D24 | Accounting cannot open Users admin. Accounting reads operational documents and master data. |
| D25 | Purchasing: Supplier → Purchase Order → Bill of Lading → Receiving Report → existing inventory ledger. PO approval and BOL posting do not move stock. One PO has many BOLs; one BOL has many receiving reports. Numbers `SUP-`, `PO-`, `BOL-`, `RR-` via `next_doc_number`. No item code and no UOM conversion; UOM is entered on the PO line. No attachments, AP, or GL. |

### Approved statuses

| Entity | Editable | Next document allowed | Terminal |
| --- | --- | --- | --- |
| Customer / Item / User | `active` (edits allowed) | — | `inactive` |
| Sales Order | `draft` | `open` (invoicing) | `cancelled`, `closed` (remaining qty 0) |
| Invoice | `draft` | `posted` (ATW) | `cancelled` |
| ATW/DR | `draft` | `released` (WS) | `cancelled` |
| Withdrawal Slip | `draft` | `issued` | `cancelled` |

SO becomes `closed` automatically when every line’s remaining invoice qty is 0. Cancelling an invoice may return the SO to `open` if it was `closed` and is not cancelled.

## Runtime

```
Browser
  → Next.js (Vercel)
      → Server Components (reads)
      → Server Actions (document mutations)
      → Route Handlers: Auth admin, health
      → @supabase/ssr cookie session (anon key)
  → PostgreSQL
      → RLS (role gate)
      → SECURITY DEFINER RPCs (allocation + unique WS)
```

`authenticated` has **SELECT** on transactional tables. Creates/edits/cancels of SO, Invoice, ATW, and WS go through RPCs. Master data writes use RLS (admin/sales). Service role is server-only and must not bypass quantity RPCs for documents.

## Folder architecture

```
app/                    # existing route folders
components/             # presentational UI
lib/supabase/           # clients
lib/auth/               # session, guards
lib/permissions/        # role matrix = RLS
lib/inventory/          # on-hand / reserved / available helpers and adjustment actions
lib/print/              # print models for invoice, ATW/DR, and withdrawal slip snapshots
lib/validation/         # Zod
lib/business/           # remaining qty and totals (tested)
lib/documents/          # Server Action / RPC wrappers
types/
supabase/migrations/
tests/
docs/
```

## Authentication

1. Email + password via Supabase Auth.
2. `public.users` 1:1 with `auth.users` (trigger). First user → `admin`; later signups default `accounting` until an admin sets the role (invite may set role immediately).
3. Roles: `admin`, `sales`, `warehouse`, `accounting` only.
4. Middleware: cookie refresh; anonymous → `/login`.
5. `status <> 'active'` cannot mutate.

## Deployment

| Piece | Host |
| --- | --- |
| Next.js | Vercel |
| Postgres, Auth, RLS | Supabase Cloud |
| Source | GitHub |

Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only).

## Installed app

Equinox is a progressive web app: `app/manifest.ts`, icons in `public/icons/`, and `public/sw.js`. The service worker does not cache `/api/` or document pages. Navigations use the network. When the network fails, `/offline` is shown. The home-screen icon is a placeholder until the company logo is supplied.
