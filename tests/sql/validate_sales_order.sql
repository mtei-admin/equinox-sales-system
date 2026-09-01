-- Phase 4 sales-order RPCs and SO → invoice remaining qty. Apply after validate_auth.sql.

drop table if exists public._phase4_results;
create table public._phase4_results (
  id serial primary key,
  area text not null,
  check_name text not null,
  passed boolean not null,
  detail text not null default ''
);

create or replace function public._phase4_record(p_area text, p_name text, p_pass boolean, p_detail text default '')
returns void
language sql
as $$
  insert into public._phase4_results (area, check_name, passed, detail)
  values (p_area, p_name, p_pass, coalesce(p_detail, ''));
$$;

do $$
declare
  sales_id uuid;
  wh_id uuid;
  cust uuid;
  cust2 uuid;
  it uuid;
  it2 uuid;
  so_id uuid;
  soi_id uuid;
  soi2 uuid;
  inv_id uuid;
  leftover numeric;
begin
  perform public._phase4_record(
    'rpc', 'update_sales_order exists',
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'update_sales_order'
    )
  );
  perform public._phase4_record(
    'rpc', 'so_item_remaining_qty exists',
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'so_item_remaining_qty'
    )
  );

  select id into sales_id from public.users where role = 'sales' and status = 'active' limit 1;
  select id into wh_id from public.users where role = 'warehouse' and status = 'active' limit 1;
  select id into cust from public.customers where name = 'Northwind Trading';
  select id into cust2 from public.customers where name = 'Horizon Builders';
  select id into it from public.items where name = 'Steel pipe 2in';
  select id into it2 from public.items where name = 'THHN wire 14mm';

  perform set_config('request.jwt.claim.sub', sales_id::text, true);

  so_id := public.create_sales_order(jsonb_build_object(
    'customer_id', cust,
    'order_date', '2026-09-01',
    'reference_no', 'P4-REF',
    'lines', jsonb_build_array(jsonb_build_object(
      'item_id', it, 'quantity', 10, 'unit_price', 100, 'uom', 'PCS'
    ))
  ));

  so_id := public.update_sales_order(so_id, jsonb_build_object(
    'customer_id', cust2,
    'delivery_address', '88 EDSA, Quezon City',
    'order_date', '2026-09-02',
    'term', 'COD',
    'lines', jsonb_build_array(
      jsonb_build_object('item_id', it, 'quantity', 8, 'unit_price', 125, 'uom', 'PCS'),
      jsonb_build_object('item_id', it2, 'quantity', 4, 'unit_price', 50, 'uom', 'ROLL')
    )
  ));

  perform public._phase4_record(
    'rpc', 'draft SO can be edited',
    (select customer_name from public.sales_orders where id = so_id) = 'Horizon Builders'
      and (select status from public.sales_orders where id = so_id) = 'draft'
      and (select total_quantity from public.sales_orders where id = so_id) = 12
      and (select grand_total from public.sales_orders where id = so_id) = 1200
      and (select count(*) from public.sales_order_items where sales_order_id = so_id) = 2,
    (select format('%s qty=%s total=%s', customer_name, total_quantity, grand_total) from public.sales_orders where id = so_id)
  );

  perform set_config('request.jwt.claim.sub', wh_id::text, true);
  begin
    perform public.update_sales_order(so_id, jsonb_build_object(
      'customer_id', cust2,
      'lines', jsonb_build_array(jsonb_build_object('item_id', it, 'quantity', 1, 'unit_price', 1))
    ));
    perform public._phase4_record('rpc', 'warehouse cannot update SO', false, 'RPC succeeded');
  exception
    when others then
      perform public._phase4_record('rpc', 'warehouse cannot update SO', sqlerrm ilike '%not authorized%', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  perform public.open_sales_order(so_id);
  begin
    perform public.update_sales_order(so_id, jsonb_build_object(
      'customer_id', cust2,
      'lines', jsonb_build_array(jsonb_build_object('item_id', it, 'quantity', 1, 'unit_price', 1))
    ));
    perform public._phase4_record('rpc', 'open SO cannot be edited', false, 'update succeeded');
  exception
    when others then
      perform public._phase4_record('rpc', 'open SO cannot be edited', sqlerrm ilike '%draft%', sqlerrm);
  end;

  select id into soi_id from public.sales_order_items where sales_order_id = so_id and item_id = it;
  select id into soi2 from public.sales_order_items where sales_order_id = so_id and item_id = it2;

  leftover := public.so_item_remaining_qty(soi_id);
  perform public._phase4_record('qty', 'remaining starts at SO qty', leftover = 8, leftover::text);

  inv_id := public.create_invoice(jsonb_build_object(
    'sales_order_id', so_id,
    'invoice_number', 'P4-INV-1',
    'lines', jsonb_build_array(jsonb_build_object(
      'sales_order_item_id', soi_id, 'quantity', 5, 'tax_amount', 0
    ))
  ));
  leftover := public.so_item_remaining_qty(soi_id);
  perform public._phase4_record('qty', 'first invoice consumes remaining', leftover = 3, leftover::text);
  leftover := public.so_item_remaining_qty(soi2);
  perform public._phase4_record('qty', 'other SO line remaining is independent', leftover = 4, leftover::text);

  begin
    perform public.create_invoice(jsonb_build_object(
      'sales_order_id', so_id,
      'invoice_number', 'P4-INV-OVER',
      'lines', jsonb_build_array(jsonb_build_object(
        'sales_order_item_id', soi_id, 'quantity', 4, 'tax_amount', 0
      ))
    ));
    perform public._phase4_record('qty', 'over-allocation rejected', false, 'over-qty accepted');
  exception
    when others then
      perform public._phase4_record('qty', 'over-allocation rejected', sqlerrm ilike '%remaining%', sqlerrm);
  end;

  perform public.create_invoice(jsonb_build_object(
    'sales_order_id', so_id,
    'invoice_number', 'P4-INV-2',
    'lines', jsonb_build_array(jsonb_build_object(
      'sales_order_item_id', soi_id, 'quantity', 3, 'tax_amount', 0
    ))
  ));
  leftover := public.so_item_remaining_qty(soi_id);
  perform public._phase4_record('qty', 'second invoice uses remaining 3', leftover = 0, leftover::text);

  perform public.cancel_invoice(inv_id, 'restore remaining');
  leftover := public.so_item_remaining_qty(soi_id);
  perform public._phase4_record('qty', 'cancelled invoice returns remaining', leftover = 5, leftover::text);

  begin
    perform public.cancel_sales_order(so_id, 'still has invoice');
    perform public._phase4_record('rpc', 'cancel blocked by invoice', false, 'cancel succeeded');
  exception
    when others then
      perform public._phase4_record('rpc', 'cancel blocked by invoice', sqlerrm ilike '%invoice%', sqlerrm);
  end;

  perform public.cancel_invoice((select id from public.invoices where invoice_number = 'P4-INV-2' limit 1), 'clear');
  perform public.cancel_sales_order(so_id, 'customer withdrew');
  perform public._phase4_record(
    'rpc', 'cancel records reason',
    (select status from public.sales_orders where id = so_id) = 'cancelled'
      and (select cancellation_reason from public.sales_orders where id = so_id) = 'customer withdrew'
      and (select cancelled_by from public.sales_orders where id = so_id) = sales_id,
    (select status::text from public.sales_orders where id = so_id)
  );

  so_id := public.create_sales_order(jsonb_build_object(
    'customer_id', cust,
    'lines', jsonb_build_array(jsonb_build_object('item_id', it, 'quantity', 1, 'unit_price', 10))
  ));
  perform public.cancel_sales_order(so_id, 'draft cancel');
  perform public._phase4_record(
    'rpc', 'draft SO can be cancelled',
    (select status from public.sales_orders where id = so_id) = 'cancelled',
    'cancelled'
  );
end
$$;

\echo
\echo === Phase 4 sales order validation report ===
select
  area,
  check_name,
  case when passed then 'PASS' else 'FAIL' end as status,
  detail
from public._phase4_results
order by id;

\echo
select
  count(*) filter (where passed) as passed,
  count(*) filter (where not passed) as failed,
  count(*) as total
from public._phase4_results;

do $$
declare
  failed int;
begin
  select count(*) into failed from public._phase4_results where not passed;
  drop function public._phase4_record(text, text, boolean, text);
  if failed > 0 then
    raise exception 'Phase 4 sales order validation failed (% checks)', failed;
  end if;
end
$$;
