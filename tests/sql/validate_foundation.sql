-- Phase 1 database validation. Apply after migrations + seed on a throwaway cluster.
-- Ends with an exception if any check failed.

drop table if exists public._phase1_results;
create table public._phase1_results (
  id serial primary key,
  area text not null,
  check_name text not null,
  passed boolean not null,
  detail text not null default ''
);

create or replace function public._phase1_record(p_area text, p_name text, p_pass boolean, p_detail text default '')
returns void
language sql
as $$
  insert into public._phase1_results (area, check_name, passed, detail)
  values (p_area, p_name, p_pass, coalesce(p_detail, ''));
$$;

-- ---------------------------------------------------------------------------
-- Catalog: tables, enums, FKs, indexes, RLS, numbering objects
-- ---------------------------------------------------------------------------

do $$
declare
  missing text;
  n int;
begin
  select string_agg(t, ', ' order by t) into missing
  from unnest(array[
    'users', 'document_sequences', 'customers', 'items',
    'sales_orders', 'sales_order_items', 'invoices', 'invoice_items',
    'atw_documents', 'atw_document_items', 'withdrawal_slips', 'withdrawal_slip_items',
    'warehouses', 'inventory_adjustments', 'inventory_adjustment_items', 'inventory_movements'
  ]) as t
  where not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = t
  );
  perform public._phase1_record('tables', 'master and transaction tables exist', missing is null, coalesce(missing, 'ok'));

  perform public._phase1_record(
    'tables', 'prototype profiles table is gone',
    not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles'),
    'profiles should be dropped by v1'
  );

  select string_agg(t, ', ') into missing
  from unnest(array['user_role', 'master_status', 'so_status', 'invoice_status', 'atw_status', 'ws_status', 'atw_document_type']) as t
  where not exists (select 1 from pg_type where typname = t);
  perform public._phase1_record('enums', 'required enums exist', missing is null, coalesce(missing, 'ok'));

  select string_agg(enumlabel, ',' order by enumsortorder) into missing
  from pg_enum e join pg_type t on t.oid = e.enumtypid
  where t.typname = 'user_role';
  perform public._phase1_record('enums', 'user_role has no viewer', missing = 'admin,sales,warehouse,accounting', missing);

  select string_agg(enumlabel, ',' order by enumsortorder) into missing
  from pg_enum e join pg_type t on t.oid = e.enumtypid
  where t.typname = 'so_status';
  perform public._phase1_record('enums', 'so_status draft/open/closed/cancelled', missing = 'draft,open,closed,cancelled', missing);

  select string_agg(enumlabel, ',' order by enumsortorder) into missing
  from pg_enum e join pg_type t on t.oid = e.enumtypid
  where t.typname = 'invoice_status';
  perform public._phase1_record('enums', 'invoice_status draft/posted/cancelled', missing = 'draft,posted,cancelled', missing);

  select string_agg(enumlabel, ',' order by enumsortorder) into missing
  from pg_enum e join pg_type t on t.oid = e.enumtypid
  where t.typname = 'atw_status';
  perform public._phase1_record('enums', 'atw_status draft/released/cancelled', missing = 'draft,released,cancelled', missing);

  select string_agg(enumlabel, ',' order by enumsortorder) into missing
  from pg_enum e join pg_type t on t.oid = e.enumtypid
  where t.typname = 'ws_status';
  perform public._phase1_record('enums', 'ws_status draft/issued/cancelled', missing = 'draft,issued,cancelled', missing);

  select string_agg(enumlabel, ',' order by enumsortorder) into missing
  from pg_enum e join pg_type t on t.oid = e.enumtypid
  where t.typname = 'atw_document_type';
  perform public._phase1_record('enums', 'atw_document_type atw/dr', missing = 'atw,dr', missing);

  select count(*) into n from information_schema.table_constraints
  where table_schema = 'public' and constraint_type = 'FOREIGN KEY';
  perform public._phase1_record('foreign_keys', 'foreign keys exist', n >= 30, format('%s FK constraints', n));

  perform public._phase1_record(
    'foreign_keys', 'users.id references auth.users',
    exists (
      select 1
      from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public' and rel.relname = 'users' and c.contype = 'f'
        and c.confrelid = 'auth.users'::regclass
    ),
    'public.users -> auth.users'
  );

  perform public._phase1_record(
    'indexes', 'unique so_number',
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.sales_orders'::regclass
        and contype in ('u', 'p')
        and pg_get_constraintdef(oid) ilike '%so_number%'
    ),
    'sales_orders.so_number unique'
  );

  perform public._phase1_record(
    'indexes', 'partial unique invoice_number',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'invoices_number_active_uidx'),
    'invoices_number_active_uidx'
  );

  perform public._phase1_record(
    'indexes', 'one active WS per ATW',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'withdrawal_slips_one_active_per_atw'),
    'withdrawal_slips_one_active_per_atw'
  );

  perform public._phase1_record(
    'indexes', 'atw_documents.document_type',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'atw_documents_type_idx'),
    'atw_documents_type_idx'
  );

  perform public._phase1_record(
    'indexes', 'customers.status',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'customers_status_idx'),
    'customers_status_idx'
  );

  perform public._phase1_record(
    'indexes', 'items.status',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'items_status_idx'),
    'items_status_idx'
  );

  perform public._phase1_record(
    'indexes', 'invoices.order_date',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'invoices_order_date_idx'),
    'invoices_order_date_idx'
  );

  perform public._phase1_record(
    'indexes', 'withdrawal_slips.status',
    exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'withdrawal_slips_status_idx'),
    'withdrawal_slips_status_idx'
  );

  select count(*) into n
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity;
  perform public._phase1_record('rls', 'RLS enabled on public tables', n >= 12, format('%s tables with RLS', n));

  select count(*) into n from pg_policies where schemaname = 'public';
  perform public._phase1_record('rls', 'RLS policies exist', n >= 16, format('%s policies', n));

  perform public._phase1_record(
    'numbering', 'document_sequences rows',
    (select count(*) from public.document_sequences) = 8
      and exists (select 1 from public.document_sequences where doc_type = 'sales_order')
      and exists (select 1 from public.document_sequences where doc_type = 'atw')
      and exists (select 1 from public.document_sequences where doc_type = 'withdrawal_slip')
      and exists (select 1 from public.document_sequences where doc_type = 'inventory_adjustment')
      and exists (select 1 from public.document_sequences where doc_type = 'supplier')
      and exists (select 1 from public.document_sequences where doc_type = 'purchase_order')
      and exists (select 1 from public.document_sequences where doc_type = 'bill_of_lading')
      and exists (select 1 from public.document_sequences where doc_type = 'receiving_report')
      and not exists (select 1 from public.document_sequences where doc_type = 'invoice'),
    'SO/ATW/WS/ADJ; invoice is typed'
  );

  perform public._phase1_record(
    'numbering', 'next_doc_number exists',
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'next_doc_number'
    ),
    'public.next_doc_number(text, text)'
  );

  perform public._phase1_record(
    'seed', 'sample customers',
    (select count(*) from public.customers) >= 2,
    format('%s customers', (select count(*) from public.customers))
  );
  perform public._phase1_record(
    'seed', 'sample items',
    (select count(*) from public.items) >= 2,
    format('%s items', (select count(*) from public.items))
  );
  perform public._phase1_record(
    'seed', 'admin user',
    exists (
      select 1 from public.users
      where username = 'admin'
        and full_name = 'JAYSON LORENO'
        and role = 'admin'
        and status = 'active'
    ),
    coalesce((select format('%s %s', role, status) from public.users where username = 'admin'), 'missing')
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Numbering behavior
-- ---------------------------------------------------------------------------

do $$
declare
  yr text := to_char(now() at time zone 'Asia/Manila', 'YYYY');
  a text;
  b text;
  c text;
begin
  a := public.next_doc_number('sales_order', 'SO-');
  b := public.next_doc_number('sales_order', 'SO-');
  c := public.next_doc_number('atw', 'ATW-');
  perform public._phase1_record('numbering', 'SO format', a = format('SO-%s-0001', yr), a);
  perform public._phase1_record('numbering', 'SO sequence increments', b = format('SO-%s-0002', yr), b);
  perform public._phase1_record('numbering', 'ATW format independent sequence', c = format('ATW-%s-0001', yr), c);
  begin
    perform public.next_doc_number('invoice', 'INV-');
    perform public._phase1_record('numbering', 'unknown type rejected', false, 'invoice sequence should not exist');
  exception
    when others then
      perform public._phase1_record('numbering', 'unknown type rejected', true, sqlerrm);
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- Constraints: amounts, unique invoice number, unique WS, lineage
-- ---------------------------------------------------------------------------

do $$
declare
  cust uuid;
  it uuid;
  so uuid;
  soi uuid;
  so2 uuid;
  soi2 uuid;
  inv uuid;
  invi uuid;
  atw uuid;
  ati uuid;
  ws uuid;
  other_cust uuid;
begin
  select id into cust from public.customers order by name limit 1;
  select id into it from public.items order by name limit 1;
  select id into other_cust from public.customers where id <> cust limit 1;

  insert into public.sales_orders (so_number, customer_id, customer_name)
  values ('SO-2026-9001', cust, 'Constraint Customer')
  returning id into so;

  begin
    insert into public.sales_order_items (
      sales_order_id, item_id, quantity, unit_price, amount, total_amount
    ) values (so, it, 2, 10, 15, 15);
    perform public._phase1_record('constraints', 'SO amount = qty * price', false, 'bad amount was accepted');
  exception
    when check_violation then
      perform public._phase1_record('constraints', 'SO amount = qty * price', true, sqlerrm);
  end;

  insert into public.sales_order_items (
    sales_order_id, item_id, quantity, unit_price, amount, total_amount
  ) values (so, it, 2, 10, 20, 20)
  returning id into soi;

  insert into public.invoices (
    invoice_number, sales_order_id, customer_id, customer_name, order_date
  ) values ('INV-BOOK-001', so, cust, 'Constraint Customer', current_date)
  returning id into inv;

  begin
    insert into public.invoice_items (
      invoice_id, sales_order_item_id, item_id, quantity, unit_price, tax_amount, amount, total_amount
    ) values (inv, soi, it, 1, 10, 1, 10, 10);
    perform public._phase1_record('constraints', 'invoice total_amount = amount + tax', false, 'mismatch accepted');
  exception
    when check_violation then
      perform public._phase1_record('constraints', 'invoice total_amount = amount + tax', true, sqlerrm);
  end;

  insert into public.invoice_items (
    invoice_id, sales_order_item_id, item_id, quantity, unit_price, tax_amount, amount, total_amount
  ) values (inv, soi, it, 1, 10, 1, 10, 11)
  returning id into invi;

  begin
    insert into public.invoices (
      invoice_number, sales_order_id, customer_id, customer_name, order_date, status
    ) values ('INV-BOOK-001', so, cust, 'Constraint Customer', current_date, 'draft');
    perform public._phase1_record('constraints', 'active invoice_number unique', false, 'duplicate accepted');
  exception
    when unique_violation then
      perform public._phase1_record('constraints', 'active invoice_number unique', true, sqlerrm);
  end;

  insert into public.invoices (
    invoice_number, sales_order_id, customer_id, customer_name, order_date, status
  ) values ('INV-BOOK-001', so, cust, 'Constraint Customer', current_date, 'cancelled');
  perform public._phase1_record('constraints', 'cancelled invoice_number reusable', true, 'INV-BOOK-001 reused after cancel');

  begin
    insert into public.invoices (
      invoice_number, sales_order_id, customer_id, customer_name, order_date
    ) values ('INV-BOOK-BAD', so, other_cust, 'Wrong', current_date);
    perform public._phase1_record('constraints', 'invoice customer matches SO', false, 'mismatch accepted');
  exception
    when others then
      perform public._phase1_record('constraints', 'invoice customer matches SO', true, sqlerrm);
  end;

  insert into public.sales_orders (so_number, customer_id, customer_name)
  values ('SO-2026-9002', cust, 'Constraint Customer')
  returning id into so2;
  insert into public.sales_order_items (
    sales_order_id, item_id, quantity, unit_price, amount, total_amount
  ) values (so2, it, 1, 5, 5, 5)
  returning id into soi2;

  begin
    insert into public.invoice_items (
      invoice_id, sales_order_item_id, item_id, quantity, unit_price, tax_amount, amount, total_amount
    ) values (inv, soi2, it, 1, 5, 0, 5, 5);
    perform public._phase1_record('constraints', 'invoice line must belong to invoice SO', false, 'cross-SO line accepted');
  exception
    when others then
      perform public._phase1_record('constraints', 'invoice line must belong to invoice SO', true, sqlerrm);
  end;

  insert into public.atw_documents (
    atw_number, invoice_id, sales_order_id, customer_id, customer_name, order_date
  ) values ('ATW-2026-9001', inv, so, cust, 'Constraint Customer', current_date)
  returning id into atw;

  insert into public.atw_document_items (
    atw_id, invoice_item_id, sales_order_item_id, item_id, invoice_item_quantity,
    quantity, unit_price, amount, total_amount
  ) values (atw, invi, soi, it, 1, 1, 10, 10, 10)
  returning id into ati;

  insert into public.withdrawal_slips (
    ws_number, atw_id, invoice_id, sales_order_id, customer_id, customer_name, order_date
  ) values ('WS-2026-9001', atw, inv, so, cust, 'Constraint Customer', current_date)
  returning id into ws;

  insert into public.withdrawal_slip_items (
    withdrawal_slip_id, atw_item_id, invoice_item_id, sales_order_item_id, item_id,
    quantity, amount, total_amount
  ) values (ws, ati, invi, soi, it, 1, 10, 10);

  begin
    insert into public.withdrawal_slips (
      ws_number, atw_id, invoice_id, sales_order_id, customer_id, customer_name, order_date
    ) values ('WS-2026-9002', atw, inv, so, cust, 'Constraint Customer', current_date);
    perform public._phase1_record('constraints', 'one active WS per ATW', false, 'second active WS accepted');
  exception
    when unique_violation then
      perform public._phase1_record('constraints', 'one active WS per ATW', true, sqlerrm);
  end;

  update public.withdrawal_slips set status = 'cancelled' where id = ws;
  insert into public.withdrawal_slips (
    ws_number, atw_id, invoice_id, sales_order_id, customer_id, customer_name, order_date
  ) values ('WS-2026-9003', atw, inv, so, cust, 'Constraint Customer', current_date);
  perform public._phase1_record('constraints', 'cancelled WS frees ATW', true, 'replacement WS inserted');

  begin
    insert into public.withdrawal_slip_items (
      withdrawal_slip_id, atw_item_id, invoice_item_id, sales_order_item_id, item_id,
      quantity, amount, total_amount
    ) values (ws, ati, invi, soi, it, 2, 20, 20);
    perform public._phase1_record('constraints', 'WS qty must match ATW line', false, 'qty mismatch accepted');
  exception
    when others then
      perform public._phase1_record('constraints', 'WS qty must match ATW line', true, sqlerrm);
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- RPCs: roles, remaining qty, cancel rules, numbering via create_*
-- ---------------------------------------------------------------------------

do $$
declare
  admin_id uuid := gen_random_uuid();
  sales_id uuid := gen_random_uuid();
  wh_id uuid := gen_random_uuid();
  acct_id uuid := gen_random_uuid();
  cust uuid;
  it uuid;
  so_id uuid;
  soi_id uuid;
  inv_id uuid;
  invi_id uuid;
  atw_id uuid;
  ws_id uuid;
  ws2 uuid;
  leftover numeric;
  yr text := to_char(now() at time zone 'Asia/Manila', 'YYYY');
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (admin_id, 'admin@phase1.local', '{"full_name":"Phase1 Admin","role":"admin","username":"phase1_admin"}'::jsonb);
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (sales_id, 'sales@phase1.local', '{"role":"sales","full_name":"Phase1 Sales"}'::jsonb),
    (wh_id, 'warehouse@phase1.local', '{"role":"warehouse","full_name":"Phase1 Warehouse"}'::jsonb),
    (acct_id, 'accounting@phase1.local', '{"role":"accounting","full_name":"Phase1 Accounting"}'::jsonb);

  perform public._phase1_record(
    'auth', 'first auth user is admin',
    (select role from public.users where id = admin_id) = 'admin',
    (select role::text from public.users where id = admin_id)
  );
  perform public._phase1_record(
    'auth', 'invite metadata role is honored',
    (select role from public.users where id = sales_id) = 'sales'
      and (select role from public.users where id = wh_id) = 'warehouse'
      and (select role from public.users where id = acct_id) = 'accounting',
    'sales/warehouse/accounting'
  );

  select id into cust from public.customers where name = 'Northwind Trading';
  select id into it from public.items where name = 'Steel pipe 2in';

  perform set_config('request.jwt.claim.sub', acct_id::text, true);
  begin
    perform public.create_sales_order(jsonb_build_object(
      'customer_id', cust,
      'lines', jsonb_build_array(jsonb_build_object('item_id', it, 'quantity', 1, 'unit_price', 10))
    ));
    perform public._phase1_record('rpc', 'accounting cannot create SO', false, 'RPC succeeded');
  exception
    when others then
      perform public._phase1_record('rpc', 'accounting cannot create SO', sqlerrm ilike '%not authorized%', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  so_id := public.create_sales_order(jsonb_build_object(
    'customer_id', cust,
    'lines', jsonb_build_array(jsonb_build_object(
      'item_id', it, 'quantity', 10, 'unit_price', 100, 'uom', 'PCS'
    ))
  ));
  perform public._phase1_record(
    'rpc', 'sales can create SO',
    so_id is not null and (select so_number from public.sales_orders where id = so_id) like 'SO-' || yr || '-%',
    (select so_number from public.sales_orders where id = so_id)
  );

  perform public.open_sales_order(so_id);
  perform public._phase1_record(
    'rpc', 'open sales order',
    (select status from public.sales_orders where id = so_id) = 'open',
    'open'
  );

  select id into soi_id from public.sales_order_items where sales_order_id = so_id;

  begin
    perform public.create_invoice(jsonb_build_object(
      'sales_order_id', so_id,
      'invoice_number', 'BOOK-100',
      'lines', jsonb_build_array(jsonb_build_object(
        'sales_order_item_id', soi_id, 'quantity', 11, 'tax_amount', 0
      ))
    ));
    perform public._phase1_record('rpc', 'invoice cannot exceed SO remaining', false, 'over-qty accepted');
  exception
    when others then
      perform public._phase1_record('rpc', 'invoice cannot exceed SO remaining', sqlerrm ilike '%remaining%', sqlerrm);
  end;

  inv_id := public.create_invoice(jsonb_build_object(
    'sales_order_id', so_id,
    'invoice_number', 'BOOK-100',
    'lines', jsonb_build_array(jsonb_build_object(
      'sales_order_item_id', soi_id, 'quantity', 10, 'tax_amount', 50
    ))
  ));
  leftover := public.round_money(10 - public.so_item_invoiced_qty(soi_id));
  perform public._phase1_record('rpc', 'invoice remaining after 10/10', leftover = 0, leftover::text);

  perform public.post_invoice(inv_id);
  perform public._phase1_record(
    'rpc', 'SO closes when remaining is 0',
    (select status from public.sales_orders where id = so_id) = 'closed',
    (select status::text from public.sales_orders where id = so_id)
  );

  select id into invi_id from public.invoice_items where invoice_id = inv_id;

  atw_id := public.create_atw_document(jsonb_build_object(
    'invoice_id', inv_id,
    'document_type', 'atw',
    'lines', jsonb_build_array(jsonb_build_object('invoice_item_id', invi_id, 'quantity', 10))
  ));
  perform public._phase1_record(
    'rpc', 'ATW number generated',
    (select atw_number from public.atw_documents where id = atw_id) ~ ('^ATW-' || yr || '-[0-9]{4}$'),
    (select atw_number from public.atw_documents where id = atw_id)
  );

  begin
    perform public.create_withdrawal_slip(jsonb_build_object('atw_id', atw_id));
    perform public._phase1_record('rpc', 'sales cannot create WS', false, 'sales created WS');
  exception
    when others then
      perform public._phase1_record('rpc', 'sales cannot create WS', sqlerrm ilike '%not authorized%', sqlerrm);
  end;

  perform public.release_atw_document(atw_id);

  perform set_config('request.jwt.claim.sub', wh_id::text, true);
  ws_id := public.create_withdrawal_slip(jsonb_build_object('atw_id', atw_id));
  perform public._phase1_record(
    'rpc', 'warehouse can create WS copying ATW lines',
    (select count(*) from public.withdrawal_slip_items where withdrawal_slip_id = ws_id) = 1
      and (select quantity from public.withdrawal_slip_items where withdrawal_slip_id = ws_id) = 10
      and (select ws_number from public.withdrawal_slips where id = ws_id) ~ ('^WS-' || yr || '-[0-9]{4}$'),
    (select ws_number from public.withdrawal_slips where id = ws_id)
  );

  begin
    perform public.create_withdrawal_slip(jsonb_build_object('atw_id', atw_id));
    perform public._phase1_record('rpc', 'second active WS rejected', false, 'second WS created');
  exception
    when others then
      perform public._phase1_record('rpc', 'second active WS rejected', true, sqlerrm);
  end;

  perform public.cancel_withdrawal_slip(ws_id, 'replace');
  ws2 := public.create_withdrawal_slip(jsonb_build_object('atw_id', atw_id));
  perform public._phase1_record('rpc', 'replacement WS after cancel', ws2 is not null and ws2 <> ws_id, ws2::text);

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  begin
    perform public.cancel_atw_document(atw_id, 'blocked');
    perform public._phase1_record('rpc', 'cancel ATW blocked by active WS', false, 'cancel succeeded');
  exception
    when others then
      perform public._phase1_record('rpc', 'cancel ATW blocked by active WS', true, sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', wh_id::text, true);
  perform public.cancel_withdrawal_slip(ws2, 'allow parent cancel');
  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  perform public.cancel_atw_document(atw_id, 'ok');
  perform public.cancel_invoice(inv_id, 'ok');
  perform public._phase1_record(
    'rpc', 'SO reopens after invoice cancel',
    (select status from public.sales_orders where id = so_id) = 'open',
    (select status::text from public.sales_orders where id = so_id)
  );
  perform public.cancel_sales_order(so_id, 'done');
  perform public._phase1_record(
    'rpc', 'SO cancelled after children cancelled',
    (select status from public.sales_orders where id = so_id) = 'cancelled',
    'cancelled'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- RLS: authenticated without INSERT grant cannot write transactional tables
-- ---------------------------------------------------------------------------

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
  acct uuid;
  cust uuid;
begin
  select id into acct from public.users where role = 'accounting' limit 1;
  select id into cust from public.customers limit 1;
  set role phase1_auth;
  perform set_config('request.jwt.claim.sub', acct::text, true);
  begin
    insert into public.sales_orders (so_number, customer_id, customer_name)
    values ('SO-2026-9999', cust, 'hack');
    reset role;
    perform public._phase1_record('rls', 'authenticated cannot insert SO directly', false, 'insert succeeded');
  exception
    when insufficient_privilege then
      reset role;
      perform public._phase1_record('rls', 'authenticated cannot insert SO directly', true, sqlerrm);
    when others then
      reset role;
      perform public._phase1_record('rls', 'authenticated cannot insert SO directly', true, sqlerrm);
  end;
exception
  when others then
    reset role;
    perform public._phase1_record('rls', 'authenticated cannot insert SO directly', false, sqlerrm);
end
$$;

\echo
\echo === Phase 1 database validation report ===
select
  area,
  check_name,
  case when passed then 'PASS' else 'FAIL' end as status,
  detail
from public._phase1_results
order by id;

\echo
select
  count(*) filter (where passed) as passed,
  count(*) filter (where not passed) as failed,
  count(*) as total
from public._phase1_results;

do $$
declare
  failed int;
begin
  select count(*) into failed from public._phase1_results where not passed;
  drop function public._phase1_record(text, text, boolean, text);
  if failed > 0 then
    raise exception 'Phase 1 database validation failed (% checks)', failed;
  end if;
end
$$;
