# Security

**Status:** approved.

## Authentication

Supabase Auth email + password. No password column on `public.users`. Session cookies via `@supabase/ssr`; middleware uses `getUser()`. Production signup disabled; Admin invites users. Trigger: first Auth user → `admin`; later default `accounting` unless invite sets `role`. Inactive (`status <> 'active'`) cannot mutate.

## Layers

UI hide + Server Action `requireRole` + RLS SELECT + RPC role check (definer bypasses RLS, so RPCs **must** check role).

## Role matrix

| Action | admin | sales | warehouse | accounting |
| --- | --- | --- | --- | --- |
| Users manage | yes | no | no | no |
| Customers / Items read | yes | yes | yes | yes |
| Customers / Items write | yes | yes | no | no |
| SO / Invoice / ATW read | yes | yes | yes | yes |
| SO / Invoice / ATW write | yes | yes | no | no |
| WS read | yes | yes | yes | yes |
| WS write | yes | no | yes | no |
| Inventory read | yes | yes | yes | yes |
| Inventory write | yes | no | yes | no |
| Suppliers / purchase orders read | yes | yes | yes | yes |
| Suppliers / purchase orders write | yes | no | no | no |
| BOL / receiving reports read | yes | yes | yes | yes |
| BOL / receiving reports write | yes | no | yes | no |

No `viewer` role. Print pages for invoices, ATW/DR, and withdrawal slips use the same read permission as the document. They do not use the service role.

The installed app’s service worker does not cache API responses or signed-in document pages.

## RLS

- SELECT transactional + master: `is_active_user()`.
- `users`: active users may select active users (id, names, role, department) for sales-employee pickers; only admin manages rows. Self may update `full_name`, `username`, `department` only — never `role` or `status` (trigger).
- Master data INSERT/UPDATE: `admin` or `sales`.
- Transactional tables: SELECT only for `authenticated`; writes via RPCs.

## Secrets

Anon key + URL public. Service role server-only. Do not log tokens, passwords, or TIN beyond operational need.
