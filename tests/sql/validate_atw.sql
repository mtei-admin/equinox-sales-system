-- Phase 6 ATW/DR allocation. Apply after validate_invoice.sql.

drop table if exists public._phase6_results;
create table public._phase6_results (
  id serial primary key,
  area text not null,
  check_name text not null,
  passed boolean not null,
  detail text not null default ''
);

create or replace function public._phase6_record(p_area text, p_name text, p_pass boolean, p_detail text default '')
returns void
language sql
as $$
  insert into public._phase6_results (area, check_name, passed, detail)
  values (p_area, p_name, p_pass, coalesce(p_detail, ''));
$$;

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
  draft_inv uuid;
  draft_item uuid;
  first_atw uuid;
  atw2 uuid;
  atw_dr uuid;
  ws_id uuid;
  leftover numeric;
  src text;
begin
  select pg_get_functiondef('public.create_atw_document(jsonb)'::regprocedure) into src;
  perform public._phase6_record(
    'lock', 'create_atw_document locks invoice header and lines',
    src ilike '%for update%' and src ilike '%invoice_items%',
    'FOR UPDATE on invoices and invoice_items'
  );
  perform public._phase6_record(
    'rpc', 'invoice_item_remaining_qty exists',
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'invoice_item_remaining_qty'
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
    'invoice_number', 'P6-SRC',
    'lines', jsonb_build_array(
      jsonb_build_object('sales_order_item_id', soi_id, 'quantity', 10, 'tax_amount', 0),
      jsonb_build_object('sales_order_item_id', soi2, 'quantity', 5, 'tax_amount', 0)
    )
  ));

  begin
    perform public.create_atw_document(jsonb_build_object(
      'invoice_id', inv_id,
      'document_type', 'atw',
      'lines', jsonb_build_array(jsonb_build_object(
        'invoice_item_id', (select id from public.invoice_items where invoice_id = inv_id limit 1),
        'quantity', 1
      ))
    ));
    perform public._phase6_record('rpc', 'draft invoice cannot create ATW/DR', false, 'ATW succeeded');
  exception
    when others then
      perform public._phase6_record('rpc', 'draft invoice cannot create ATW/DR', sqlerrm ilike '%posted%', sqlerrm);
  end;

  perform public.post_invoice(inv_id);
  select id into invi_id from public.invoice_items where invoice_id = inv_id and sales_order_item_id = soi_id;
  select id into invi2 from public.invoice_items where invoice_id = inv_id and sales_order_item_id = soi2;

  perform set_config('request.jwt.claim.sub', wh_id::text, true);
  begin
    perform public.create_atw_document(jsonb_build_object(
      'invoice_id', inv_id,
      'document_type', 'atw',
      'lines', jsonb_build_array(jsonb_build_object('invoice_item_id', invi_id, 'quantity', 1))
    ));
    perform public._phase6_record('rpc', 'warehouse cannot create ATW/DR', false, 'RPC succeeded');
  exception
    when others then
      perform public._phase6_record('rpc', 'warehouse cannot create ATW/DR', sqlerrm ilike '%not authorized%', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', acct_id::text, true);
  begin
    perform public.create_atw_document(jsonb_build_object(
      'invoice_id', inv_id,
      'document_type', 'dr',
      'lines', jsonb_build_array(jsonb_build_object('invoice_item_id', invi_id, 'quantity', 1))
    ));
    perform public._phase6_record('rpc', 'accounting cannot create ATW/DR', false, 'RPC succeeded');
  exception
    when others then
      perform public._phase6_record('rpc', 'accounting cannot create ATW/DR', sqlerrm ilike '%not authorized%', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);

  begin
    perform public.create_atw_document(jsonb_build_object(
      'invoice_id', inv_id,
      'document_type', 'atw',
      'lines', jsonb_build_array(jsonb_build_object('invoice_item_id', invi_id, 'quantity', 11))
    ));
    perform public._phase6_record('qty', 'over-allocation rejected', false, 'over-qty accepted');
  exception
    when others then
      perform public._phase6_record('qty', 'over-allocation rejected', sqlerrm ilike '%remaining%', sqlerrm);
  end;

  first_atw := public.create_atw_document(jsonb_build_object(
    'invoice_id', inv_id,
    'document_type', 'atw',
    'lines', jsonb_build_array(jsonb_build_object('invoice_item_id', invi_id, 'quantity', 4))
  ));
  leftover := public.invoice_item_remaining_qty(invi_id);
  perform public._phase6_record(
    'qty', 'partial ATW leaves remaining',
    leftover = 6
      and (select amount from public.atw_document_items as adi where adi.atw_id = first_atw) = 400
      and (select grand_total from public.atw_documents as ad where ad.id = first_atw) = 400
      and (select document_type from public.atw_documents as ad where ad.id = first_atw) = 'atw',
    leftover::text
  );
  leftover := public.invoice_item_remaining_qty(invi2);
  perform public._phase6_record('qty', 'unselected invoice line is unchanged', leftover = 5, leftover::text);

  atw2 := public.create_atw_document(jsonb_build_object(
    'invoice_id', inv_id,
    'document_type', 'atw',
    'lines', jsonb_build_array(
      jsonb_build_object('invoice_item_id', invi_id, 'quantity', 6),
      jsonb_build_object('invoice_item_id', invi2, 'quantity', 5)
    )
  ));
  leftover := public.invoice_item_remaining_qty(invi_id) + public.invoice_item_remaining_qty(invi2);
  perform public._phase6_record(
    'qty', 'multiple ATW/DR documents can finish the invoice',
    leftover = 0 and atw2 is not null,
    leftover::text
  );

  begin
    perform public.create_atw_document(jsonb_build_object(
      'invoice_id', inv_id,
      'document_type', 'dr',
      'lines', jsonb_build_array(jsonb_build_object('invoice_item_id', invi_id, 'quantity', 1))
    ));
    perform public._phase6_record('qty', 'already fully allocated invoice rejected', false, 'second full ATW accepted');
  exception
    when others then
      perform public._phase6_record(
        'qty', 'already fully allocated invoice rejected',
        sqlerrm ilike '%fully allocated%' or sqlerrm ilike '%remaining%',
        sqlerrm
      );
  end;

  perform public.cancel_atw_document(atw2, 'restore remaining');
  leftover := public.invoice_item_remaining_qty(invi_id) + public.invoice_item_remaining_qty(invi2);
  perform public._phase6_record(
    'qty', 'cancelled ATW/DR restores remaining',
    leftover = 11
      and (select status from public.atw_documents where id = atw2) = 'cancelled',
    leftover::text
  );

  atw_dr := public.create_atw_document(jsonb_build_object(
    'invoice_id', inv_id,
    'document_type', 'dr',
    'remarks', 'Gate 2',
    'lines', jsonb_build_array(jsonb_build_object('invoice_item_id', invi2, 'quantity', 5))
  ));
  perform public._phase6_record(
    'rpc', 'document type DR is stored',
    (select document_type from public.atw_documents where id = atw_dr) = 'dr',
    (select document_type::text from public.atw_documents where id = atw_dr)
  );

  perform public.release_atw_document(atw_dr);
  perform public._phase6_record(
    'rpc', 'draft ATW/DR can be released',
    (select status from public.atw_documents where id = atw_dr) = 'released',
    (select status::text from public.atw_documents where id = atw_dr)
  );

  perform set_config('request.jwt.claim.sub', wh_id::text, true);
  ws_id := public.create_withdrawal_slip(jsonb_build_object('atw_id', atw_dr));
  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  begin
    perform public.cancel_atw_document(atw_dr, 'blocked by slip');
    perform public._phase6_record('rpc', 'cancel blocked while withdrawal slip exists', false, 'cancel succeeded');
  exception
    when others then
      perform public._phase6_record(
        'rpc', 'cancel blocked while withdrawal slip exists',
        sqlerrm ilike '%withdrawal slip%',
        sqlerrm
      );
  end;

  so_id := public.create_sales_order(jsonb_build_object(
    'customer_id', cust,
    'lines', jsonb_build_array(jsonb_build_object('item_id', it, 'quantity', 3, 'unit_price', 50))
  ));
  perform public.open_sales_order(so_id);
  select id into soi_id from public.sales_order_items where sales_order_id = so_id;
  draft_inv := public.create_invoice(jsonb_build_object(
    'sales_order_id', so_id,
    'invoice_number', 'P6-DRAFT',
    'lines', jsonb_build_array(jsonb_build_object('sales_order_item_id', soi_id, 'quantity', 3, 'tax_amount', 0))
  ));
  select id into draft_item from public.invoice_items where invoice_id = draft_inv;
  begin
    perform public.create_atw_document(jsonb_build_object(
      'invoice_id', draft_inv,
      'document_type', 'atw',
      'lines', jsonb_build_array(jsonb_build_object('invoice_item_id', draft_item, 'quantity', 1))
    ));
    perform public._phase6_record('rpc', 'unposted invoice cannot create ATW/DR', false, 'ATW succeeded');
  exception
    when others then
      perform public._phase6_record('rpc', 'unposted invoice cannot create ATW/DR', sqlerrm ilike '%posted%', sqlerrm);
  end;
end
$$;

\echo
\echo === Phase 6 ATW/DR validation report ===
select
  area,
  check_name,
  case when passed then 'PASS' else 'FAIL' end as status,
  detail
from public._phase6_results
order by id;

\echo
select
  count(*) filter (where passed) as passed,
  count(*) filter (where not passed) as failed,
  count(*) as total
from public._phase6_results;

do $$
declare
  failed int;
begin
  select count(*) into failed from public._phase6_results where not passed;
  drop function public._phase6_record(text, text, boolean, text);
  if failed > 0 then
    raise exception 'Phase 6 ATW/DR validation failed (% checks)', failed;
  end if;
end
$$;
