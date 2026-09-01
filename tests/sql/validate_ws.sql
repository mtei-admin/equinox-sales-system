-- Phase 7 withdrawal slips. Apply after validate_atw.sql.

drop table if exists public._phase7_results;
create table public._phase7_results (
  id serial primary key,
  area text not null,
  check_name text not null,
  passed boolean not null,
  detail text not null default ''
);

create or replace function public._phase7_record(p_area text, p_name text, p_pass boolean, p_detail text default '')
returns void
language sql
as $$
  insert into public._phase7_results (area, check_name, passed, detail)
  values (p_area, p_name, p_pass, coalesce(p_detail, ''));
$$;

drop table if exists public._phase7_conc;
create table public._phase7_conc (
  atw_id uuid not null,
  warehouse_id uuid not null
);

do $$
declare
  sales_id uuid;
  wh_id uuid;
  acct_id uuid;
  cust uuid;
  it uuid;
  it2 uuid;
  so_id uuid;
  soi_id uuid;
  soi2 uuid;
  inv_id uuid;
  invi_id uuid;
  invi2 uuid;
  atw_doc uuid;
  atw_line uuid;
  atw_line2 uuid;
  draft_atw uuid;
  conc_atw uuid;
  first_ws uuid;
  ws2 uuid;
  src text;
  leftover int;
begin
  select pg_get_functiondef('public.create_withdrawal_slip(jsonb)'::regprocedure) into src;
  perform public._phase7_record(
    'lock', 'create_withdrawal_slip locks ATW header and lines',
    src ilike '%for update%' and src ilike '%atw_document_items%',
    'FOR UPDATE on atw_documents and atw_document_items'
  );
  perform public._phase7_record(
    'lock', 'one active WS per ATW unique index',
    exists (
      select 1 from pg_indexes
      where schemaname = 'public' and indexname = 'withdrawal_slips_one_active_per_atw'
    ),
    'withdrawal_slips_one_active_per_atw'
  );
  perform public._phase7_record(
    'rpc', 'update_withdrawal_slip exists',
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'update_withdrawal_slip'
    ),
    'helper'
  );

  select id into sales_id from public.users where role = 'sales' and status = 'active' limit 1;
  select id into wh_id from public.users where role = 'warehouse' and status = 'active' limit 1;
  select id into acct_id from public.users where role = 'accounting' and status = 'active' limit 1;
  select id into cust from public.customers where name = 'Northwind Trading';
  select id into it from public.items where name = 'Steel pipe 2in';
  select id into it2 from public.items where name = 'THHN wire 14mm';

  perform set_config('request.jwt.claim.sub', sales_id::text, true);

  so_id := public.create_sales_order(jsonb_build_object(
    'customer_id', cust,
    'lines', jsonb_build_array(
      jsonb_build_object('item_id', it, 'quantity', 10, 'unit_price', 100, 'uom', 'PCS'),
      jsonb_build_object('item_id', it2, 'quantity', 5, 'unit_price', 40, 'uom', 'ROLL')
    )
  ));
  perform public.open_sales_order(so_id);
  select id into soi_id from public.sales_order_items where sales_order_id = so_id and item_id = it;
  select id into soi2 from public.sales_order_items where sales_order_id = so_id and item_id = it2;
  inv_id := public.create_invoice(jsonb_build_object(
    'sales_order_id', so_id,
    'invoice_number', 'P7-SRC',
    'lines', jsonb_build_array(
      jsonb_build_object('sales_order_item_id', soi_id, 'quantity', 10, 'tax_amount', 0),
      jsonb_build_object('sales_order_item_id', soi2, 'quantity', 5, 'tax_amount', 0)
    )
  ));
  perform public.post_invoice(inv_id);
  select id into invi_id from public.invoice_items where invoice_id = inv_id and sales_order_item_id = soi_id;
  select id into invi2 from public.invoice_items where invoice_id = inv_id and sales_order_item_id = soi2;

  draft_atw := public.create_atw_document(jsonb_build_object(
    'invoice_id', inv_id,
    'document_type', 'atw',
    'lines', jsonb_build_array(jsonb_build_object('invoice_item_id', invi_id, 'quantity', 4))
  ));

  perform set_config('request.jwt.claim.sub', wh_id::text, true);
  begin
    perform public.create_withdrawal_slip(jsonb_build_object('atw_id', draft_atw));
    perform public._phase7_record('rpc', 'unreleased ATW cannot create WS', false, 'WS succeeded');
  exception
    when others then
      perform public._phase7_record('rpc', 'unreleased ATW cannot create WS', sqlerrm ilike '%released%', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  perform public.release_atw_document(draft_atw);

  atw_doc := public.create_atw_document(jsonb_build_object(
    'invoice_id', inv_id,
    'document_type', 'dr',
    'lines', jsonb_build_array(
      jsonb_build_object('invoice_item_id', invi_id, 'quantity', 6),
      jsonb_build_object('invoice_item_id', invi2, 'quantity', 5)
    )
  ));
  perform public.release_atw_document(atw_doc);
  select id into atw_line from public.atw_document_items where atw_id = atw_doc and invoice_item_id = invi_id;
  select id into atw_line2 from public.atw_document_items where atw_id = atw_doc and invoice_item_id = invi2;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  begin
    perform public.create_withdrawal_slip(jsonb_build_object('atw_id', atw_doc));
    perform public._phase7_record('rpc', 'sales cannot create WS', false, 'RPC succeeded');
  exception
    when others then
      perform public._phase7_record('rpc', 'sales cannot create WS', sqlerrm ilike '%not authorized%', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', acct_id::text, true);
  begin
    perform public.create_withdrawal_slip(jsonb_build_object('atw_id', atw_doc));
    perform public._phase7_record('rpc', 'accounting cannot create WS', false, 'RPC succeeded');
  exception
    when others then
      perform public._phase7_record('rpc', 'accounting cannot create WS', sqlerrm ilike '%not authorized%', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', wh_id::text, true);
  begin
    perform public.create_withdrawal_slip(jsonb_build_object(
      'atw_id', atw_doc,
      'lines', jsonb_build_array(
        jsonb_build_object('atw_item_id', atw_line, 'quantity', 5),
        jsonb_build_object('atw_item_id', atw_line2, 'quantity', 5)
      )
    ));
    perform public._phase7_record('qty', 'qty mismatch rejected', false, 'mismatch accepted');
  exception
    when others then
      perform public._phase7_record('qty', 'qty mismatch rejected', sqlerrm ilike '%match%', sqlerrm);
  end;

  first_ws := public.create_withdrawal_slip(jsonb_build_object(
    'atw_id', atw_doc,
    'remarks', 'Dock 3',
    'lines', jsonb_build_array(
      jsonb_build_object('atw_item_id', atw_line, 'quantity', 6),
      jsonb_build_object('atw_item_id', atw_line2, 'quantity', 5)
    )
  ));
  leftover := (select count(*) from public.withdrawal_slip_items where withdrawal_slip_id = first_ws);
  perform public._phase7_record(
    'qty', 'create copies every ATW/DR line',
    leftover = 2
      and (select total_quantity from public.withdrawal_slips where id = first_ws) = 11
      and (select grand_total from public.withdrawal_slips where id = first_ws) = 800
      and (select remarks from public.withdrawal_slips where id = first_ws) = 'Dock 3',
    leftover::text
  );

  begin
    perform public.create_withdrawal_slip(jsonb_build_object('atw_id', atw_doc));
    perform public._phase7_record('rpc', 'second active WS rejected', false, 'duplicate accepted');
  exception
    when others then
      perform public._phase7_record(
        'rpc', 'second active WS rejected',
        sqlerrm ilike '%already has a withdrawal slip%',
        sqlerrm
      );
  end;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  begin
    perform public.update_withdrawal_slip(first_ws, jsonb_build_object('remarks', 'hack'));
    perform public._phase7_record('rpc', 'sales cannot update WS', false, 'update succeeded');
  exception
    when others then
      perform public._phase7_record('rpc', 'sales cannot update WS', sqlerrm ilike '%not authorized%', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', wh_id::text, true);
  perform public.update_withdrawal_slip(first_ws, jsonb_build_object(
    'remarks', 'Gate 4',
    'lines', jsonb_build_array(
      jsonb_build_object('atw_item_id', atw_line, 'quantity', 6),
      jsonb_build_object('atw_item_id', atw_line2, 'quantity', 5)
    )
  ));
  perform public._phase7_record(
    'rpc', 'draft WS remarks can be saved',
    (select remarks from public.withdrawal_slips where id = first_ws) = 'Gate 4',
    (select remarks from public.withdrawal_slips where id = first_ws)
  );

  perform public.issue_withdrawal_slip(first_ws);
  begin
    perform public.update_withdrawal_slip(first_ws, jsonb_build_object('remarks', 'too late'));
    perform public._phase7_record('rpc', 'issued WS cannot be edited', false, 'update succeeded');
  exception
    when others then
      perform public._phase7_record('rpc', 'issued WS cannot be edited', sqlerrm ilike '%draft%', sqlerrm);
  end;

  perform public.cancel_withdrawal_slip(first_ws, 'replace');
  perform public._phase7_record(
    'rpc', 'cancel records reason and frees ATW',
    (select status from public.withdrawal_slips where id = first_ws) = 'cancelled'
      and (select cancellation_reason from public.withdrawal_slips where id = first_ws) = 'replace'
      and not exists (
        select 1 from public.withdrawal_slips as slip
        where slip.atw_id = atw_doc and slip.status <> 'cancelled'
      ),
    (select status::text from public.withdrawal_slips where id = first_ws)
  );

  ws2 := public.create_withdrawal_slip(jsonb_build_object('atw_id', atw_doc));
  perform public._phase7_record(
    'rpc', 'replacement WS after cancel',
    ws2 is not null and ws2 is distinct from first_ws,
    ws2::text
  );

  -- Concurrent duplicate create against a fresh released ATW.
  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  so_id := public.create_sales_order(jsonb_build_object(
    'customer_id', cust,
    'lines', jsonb_build_array(jsonb_build_object('item_id', it, 'quantity', 2, 'unit_price', 50))
  ));
  perform public.open_sales_order(so_id);
  select id into soi_id from public.sales_order_items where sales_order_id = so_id;
  inv_id := public.create_invoice(jsonb_build_object(
    'sales_order_id', so_id,
    'invoice_number', 'P7-CONC',
    'lines', jsonb_build_array(jsonb_build_object('sales_order_item_id', soi_id, 'quantity', 2, 'tax_amount', 0))
  ));
  perform public.post_invoice(inv_id);
  select id into invi_id from public.invoice_items where invoice_id = inv_id;
  conc_atw := public.create_atw_document(jsonb_build_object(
    'invoice_id', inv_id,
    'document_type', 'atw',
    'lines', jsonb_build_array(jsonb_build_object('invoice_item_id', invi_id, 'quantity', 2))
  ));
  perform public.release_atw_document(conc_atw);
  insert into public._phase7_conc (atw_id, warehouse_id) values (conc_atw, wh_id);
end
$$;

do $$
declare
  conc_atw uuid;
  wh_id uuid;
  conn text;
  remote text;
  payload jsonb;
  ok_a boolean := false;
  ok_b boolean := false;
  succeeded int := 0;
  failed int := 0;
  err_a text := '';
  err_b text := '';
  leftover int;
  i int;
begin
  select atw_id, warehouse_id into conc_atw, wh_id from public._phase7_conc limit 1;
  begin
    create extension if not exists dblink;
    conn := format('host=127.0.0.1 port=%s dbname=%s user=postgres', current_setting('port'), current_database());
    payload := jsonb_build_object('atw_id', conc_atw);
    remote := format(
      'select public.create_withdrawal_slip(%L::jsonb) from (select set_config(''request.jwt.claim.sub'', %L, true)) s',
      payload::text,
      wh_id::text
    );
    perform dblink_connect('ws_a', conn);
    perform dblink_connect('ws_b', conn);
    perform dblink_send_query('ws_a', remote);
    perform dblink_send_query('ws_b', remote);
    for i in 1..200 loop
      exit when dblink_is_busy('ws_a') = 0 and dblink_is_busy('ws_b') = 0;
      perform pg_sleep(0.05);
    end loop;
    begin
      perform * from dblink_get_result('ws_a') as t(id uuid);
      ok_a := true;
    exception
      when others then
        err_a := sqlerrm;
    end;
    begin
      perform * from dblink_get_result('ws_b') as t(id uuid);
      ok_b := true;
    exception
      when others then
        err_b := sqlerrm;
    end;
    if ok_a then succeeded := succeeded + 1; else failed := failed + 1; end if;
    if ok_b then succeeded := succeeded + 1; else failed := failed + 1; end if;
    perform dblink_disconnect('ws_a');
    perform dblink_disconnect('ws_b');
    leftover := (
      select count(*) from public.withdrawal_slips as slip
      where slip.atw_id = conc_atw and slip.status <> 'cancelled'
    );
    perform public._phase7_record(
      'lock', 'concurrent duplicate WS create',
      leftover = 1 and succeeded = 1 and failed = 1,
      format('active=%s succeeded=%s failed=%s a=%s b=%s', leftover, succeeded, failed, err_a, err_b)
    );
  exception
    when others then
      perform public._phase7_record('lock', 'concurrent duplicate WS create', false, sqlerrm);
  end;
end
$$;

\echo
\echo === Phase 7 withdrawal slip validation report ===
select
  area,
  check_name,
  case when passed then 'PASS' else 'FAIL' end as status,
  detail
from public._phase7_results
order by id;

\echo
select
  count(*) filter (where passed) as passed,
  count(*) filter (where not passed) as failed,
  count(*) as total
from public._phase7_results;

do $$
declare
  failed int;
begin
  select count(*) into failed from public._phase7_results where not passed;
  drop function public._phase7_record(text, text, boolean, text);
  if failed > 0 then
    raise exception 'Phase 7 withdrawal slip validation failed (% checks)', failed;
  end if;
end
$$;
