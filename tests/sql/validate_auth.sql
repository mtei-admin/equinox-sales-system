-- Phase 2 RLS / role checks. Apply after migrations (and optionally after validate_foundation.sql).

drop table if exists public._phase2_results;
create table public._phase2_results (
  id serial primary key,
  area text not null,
  check_name text not null,
  passed boolean not null,
  detail text not null default ''
);

create or replace function public._phase2_record(p_area text, p_name text, p_pass boolean, p_detail text default '')
returns void
language sql
as $$
  insert into public._phase2_results (area, check_name, passed, detail)
  values (p_area, p_name, p_pass, coalesce(p_detail, ''));
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'phase1_auth') then
    create role phase1_auth login password 'phase1';
  end if;
  grant authenticated to phase1_auth;
end
$$;

do $$
declare
  admin_id uuid;
  sales_id uuid;
  wh_id uuid;
  acct_id uuid;
  n int;
  own_name text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  select gen_random_uuid(), 'phase2-admin@local', '{"full_name":"P2 Admin"}'::jsonb
  where not exists (select 1 from public.users where role = 'admin');

  insert into auth.users (id, email, raw_user_meta_data)
  select gen_random_uuid(), 'phase2-sales@local', '{"role":"sales","full_name":"P2 Sales"}'::jsonb
  where not exists (select 1 from public.users where role = 'sales');

  insert into auth.users (id, email, raw_user_meta_data)
  select gen_random_uuid(), 'phase2-wh@local', '{"role":"warehouse","full_name":"P2 Warehouse"}'::jsonb
  where not exists (select 1 from public.users where role = 'warehouse');

  insert into auth.users (id, email, raw_user_meta_data)
  select gen_random_uuid(), 'phase2-acct@local', '{"role":"accounting","full_name":"P2 Accounting"}'::jsonb
  where not exists (select 1 from public.users where role = 'accounting');

  select id into admin_id from public.users where role = 'admin' and status = 'active' limit 1;
  select id into sales_id from public.users where role = 'sales' and status = 'active' limit 1;
  select id into wh_id from public.users where role = 'warehouse' and status = 'active' limit 1;
  select id into acct_id from public.users where role = 'accounting' and status = 'active' limit 1;

  perform public._phase2_record(
    'roles', 'four active roles exist',
    admin_id is not null and sales_id is not null and wh_id is not null and acct_id is not null,
    format('admin=%s sales=%s warehouse=%s accounting=%s', admin_id, sales_id, wh_id, acct_id)
  );

  -- ADMIN: can update another user's role
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set role phase1_auth;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.users set department = 'HQ' where id = sales_id;
  get diagnostics n = row_count;
  reset role;
  perform public._phase2_record('admin', 'can update another user profile', n = 1, format('rows=%s', n));

  -- SALES: cannot change another user's role
  set role phase1_auth;
  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  update public.users set role = 'admin' where id = acct_id;
  get diagnostics n = row_count;
  reset role;
  perform public._phase2_record('sales', 'cannot escalate another user', n = 0
    and (select role from public.users where id = acct_id) = 'accounting', format('rows=%s', n));

  -- SALES: self role change blocked by trigger
  set role phase1_auth;
  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  begin
    update public.users set role = 'admin' where id = sales_id;
    reset role;
    perform public._phase2_record('sales', 'cannot self-escalate role', false, 'update succeeded');
  exception
    when others then
      reset role;
      perform public._phase2_record('sales', 'cannot self-escalate role', sqlerrm ilike '%only admin%', sqlerrm);
  end;

  -- SALES: can insert customer
  set role phase1_auth;
  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  begin
    insert into public.customers (name, status) values ('P2 Sales Customer', 'active');
    reset role;
    perform public._phase2_record('sales', 'can insert customer', true, 'ok');
  exception
    when others then
      reset role;
      perform public._phase2_record('sales', 'can insert customer', false, sqlerrm);
  end;

  -- SALES: cannot insert SO header directly
  set role phase1_auth;
  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  begin
    insert into public.sales_orders (so_number, customer_id, customer_name)
    values ('SO-2026-8888', (select id from public.customers limit 1), 'hack');
    reset role;
    perform public._phase2_record('sales', 'cannot insert SO without RPC grant', false, 'insert succeeded');
  exception
    when others then
      reset role;
      perform public._phase2_record('sales', 'cannot insert SO without RPC grant', true, sqlerrm);
  end;

  -- WAREHOUSE: cannot insert customer
  set role phase1_auth;
  perform set_config('request.jwt.claim.sub', wh_id::text, true);
  begin
    insert into public.customers (name, status) values ('P2 Warehouse Customer', 'active');
    reset role;
    perform public._phase2_record('warehouse', 'cannot insert customer', false, 'insert succeeded');
  exception
    when others then
      reset role;
      perform public._phase2_record('warehouse', 'cannot insert customer', true, sqlerrm);
  end;

  -- WAREHOUSE: can read customers
  set role phase1_auth;
  perform set_config('request.jwt.claim.sub', wh_id::text, true);
  select count(*) into n from public.customers;
  reset role;
  perform public._phase2_record('warehouse', 'can read customers', n > 0, format('count=%s', n));

  -- ACCOUNTING: cannot insert items
  set role phase1_auth;
  perform set_config('request.jwt.claim.sub', acct_id::text, true);
  begin
    insert into public.items (name, status) values ('P2 Accounting Item', 'active');
    reset role;
    perform public._phase2_record('accounting', 'cannot insert item', false, 'insert succeeded');
  exception
    when others then
      reset role;
      perform public._phase2_record('accounting', 'cannot insert item', true, sqlerrm);
  end;

  -- ACCOUNTING: can read items
  set role phase1_auth;
  perform set_config('request.jwt.claim.sub', acct_id::text, true);
  select count(*) into n from public.items;
  reset role;
  perform public._phase2_record('accounting', 'can read items', n > 0, format('count=%s', n));

  -- ACCOUNTING: cannot manage users
  set role phase1_auth;
  perform set_config('request.jwt.claim.sub', acct_id::text, true);
  update public.users set role = 'admin' where id = sales_id;
  get diagnostics n = row_count;
  reset role;
  perform public._phase2_record('accounting', 'cannot change user roles', n = 0, format('rows=%s', n));

  -- SALES: can update own profile fields
  set role phase1_auth;
  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  update public.users set full_name = 'Sales Updated' where id = sales_id;
  select full_name into own_name from public.users where id = sales_id;
  reset role;
  perform public._phase2_record('sales', 'can update own full_name', own_name = 'Sales Updated', own_name);

  -- INACTIVE: cannot read master data
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.users set status = 'inactive' where id = acct_id;
  set role phase1_auth;
  perform set_config('request.jwt.claim.sub', acct_id::text, true);
  select count(*) into n from public.customers;
  reset role;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.users set status = 'active' where id = acct_id;
  perform public._phase2_record('inactive', 'inactive user sees no customers', n = 0, format('count=%s', n));
end
$$;

\echo
\echo === Phase 2 authorization validation report ===
select
  area,
  check_name,
  case when passed then 'PASS' else 'FAIL' end as status,
  detail
from public._phase2_results
order by id;

\echo
select
  count(*) filter (where passed) as passed,
  count(*) filter (where not passed) as failed,
  count(*) as total
from public._phase2_results;

do $$
declare
  failed int;
begin
  select count(*) into failed from public._phase2_results where not passed;
  drop function public._phase2_record(text, text, boolean, text);
  if failed > 0 then
    raise exception 'Phase 2 authorization validation failed (% checks)', failed;
  end if;
end
$$;
