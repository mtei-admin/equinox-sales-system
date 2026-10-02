# Equinox Sales System

Order-to-warehouse sales operations for Equinox: customers, items, users, sales orders, invoices, ATW/DR, withdrawal slips, and reports.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router), React, TypeScript, Tailwind CSS |
| Backend | Supabase — PostgreSQL, Auth, Row Level Security |
| Hosting | Vercel + Supabase Cloud |
| Tooling | Cursor project rules, Git, GitHub |

## Document flow

```
Customer + Item
      ↓
Sales Order  →  Invoice  →  ATW / DR  →  Withdrawal Slip
                                         (stock decreases here)
```

## Setup

1. Copy environment variables:

```bash
cp .env.example .env.local
```

2. Create a Supabase project and paste `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` into `.env.local`. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.

3. Apply the schema:

```bash
supabase db push
```

Or run `supabase/migrations/20240901000000_init.sql` in the Supabase SQL editor, then `supabase/seed.sql`.

4. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3002](http://localhost:3002). Equinox always uses port 3002. Sign in with a user from Supabase Auth. The first user is **admin**. Later signups default to **accounting** until an admin changes the role.

Approved workflow, schema, and RPCs are in `docs/`. Apply both migrations:

`20240901000000_init.sql` (prototype, then replaced by)
`20260901000000_equinox_v1.sql` and `20260901000001_functions_rls.sql`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Next.js dev server on port 3002 |
| `npm run build` | Production build |
| `npm run test:run` | Unit tests (business rules and permissions) |
| `npm run lint` | ESLint |

## Project layout

See the folders in this repo. Cursor rules in `.cursor/rules/` describe how to change each area. Human docs live in `docs/`.
