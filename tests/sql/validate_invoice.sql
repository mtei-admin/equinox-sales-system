-- Phase 5 invoice allocation. Apply after validate_sales_order.sql.

drop table if exists public._phase5_results;
create table public._phase5_results (
  id serial primary key,
  area text not null,
  check_name text not null,
  passed boolean not null,
  detail text not null default ''
);

create or replace function public._phase5_record(p_area text, p_name text, p_pass boolean, p_detail text default '')
returns void
language sql
as $$
  insert into public._phase5_results (area, check_name, passed, detail)
  values (p_area, p_name, p_pass, coalesce(p_detail, ''));
$$;

do $$
declare
  sales_id uuid;
  wh_id uuid;
  cust uuid;
  it uuid;
  it2 uuid;
  so_id uuid;
  soi_id uuid;
  soi2 uuid;
  inv_id uuid;
  inv2 uuid;
  leftover numeric;
  src text;
begin
  select pg_get_functiondef('public.create_invoice(jsonb)'::regprocedure) into src;
  perform public._phase5_record(
    'lock', 'create_invoice locks SO header and lines',
    src ilike '%for update%' and src ilike '%sales_order_items%',
    'FOR UPDATE on sales_orders and sales_order_items'
  );

  select id into sales_id from public.users where role = 'sales' and status = 'active' limit 1;
  select id into wh_id from public.users where role = 'warehouse' and status = 'active' limit 1;
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

  perform set_config('request.jwt.claim.sub', wh_id::text, true);
  begin
    perform public.create_invoice(jsonb_build_object(
      'sales_order_id', so_id,
      'invoice_number', 'P5-WH',
      'lines', jsonb_build_array(jsonb_build_object('sales_order_item_id', soi_id, 'quantity', 1))
    ));
    perform public._phase5_record('rpc', 'warehouse cannot create invoice', false, 'RPC succeeded');
  exception
    when others then
      perform public._phase5_record('rpc', 'warehouse cannot create invoice', sqlerrm ilike '%not authorized%', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);

  begin
    perform public.create_invoice(jsonb_build_object(
      'sales_order_id', so_id,
      'invoice_number', 'P5-OVER',
      'lines', jsonb_build_array(jsonb_build_object('sales_order_item_id', soi_id, 'quantity', 11, 'tax_amount', 0))
    ));
    perform public._phase5_record('qty', 'over-invoicing rejected', false, 'over-qty accepted');
  exception
    when others then
      perform public._phase5_record('qty', 'over-invoicing rejected', sqlerrm ilike '%remaining%', sqlerrm);
  end;

  inv_id := public.create_invoice(jsonb_build_object(
    'sales_order_id', so_id,
    'invoice_number', 'P5-PARTIAL',
    'lines', jsonb_build_array(jsonb_build_object(
      'sales_order_item_id', soi_id, 'quantity', 4, 'tax_amount', 20
    ))
  ));
  leftover := public.so_item_remaining_qty(soi_id);
  perform public._phase5_record(
    'qty', 'partial invoice leaves remaining',
    leftover = 6
      and (select total_amount from public.invoice_items where invoice_id = inv_id) = 420
      and (select grand_total from public.invoices where id = inv_id) = 420,
    leftover::text
  );
  leftover := public.so_item_remaining_qty(soi2);
  perform public._phase5_record('qty', 'unselected SO line is unchanged', leftover = 5, leftover::text);

  inv2 := public.create_invoice(jsonb_build_object(
    'sales_order_id', so_id,
    'invoice_number', 'P5-SECOND',
    'lines', jsonb_build_array(
      jsonb_build_object('sales_order_item_id', soi_id, 'quantity', 6, 'tax_amount', 0),
      jsonb_build_object('sales_order_item_id', soi2, 'quantity', 5, 'tax_amount', 0)
    )
  ));
  leftover := public.so_item_remaining_qty(soi_id) + public.so_item_remaining_qty(soi2);
  perform public._phase5_record(
    'qty', 'multiple invoices can finish the SO',
    leftover = 0 and inv2 is not null,
    leftover::text
  );

  begin
    perform public.create_invoice(jsonb_build_object(
      'sales_order_id', so_id,
      'invoice_number', 'P5-FULL-AGAIN',
      'lines', jsonb_build_array(jsonb_build_object('sales_order_item_id', soi_id, 'quantity', 1))
    ));
    perform public._phase5_record('qty', 'already fully invoiced SO rejected', false, 'second full invoice accepted');
  exception
    when others then
      perform public._phase5_record(
        'qty', 'already fully invoiced SO rejected',
        sqlerrm ilike '%fully invoiced%' or sqlerrm ilike '%remaining%',
        sqlerrm
      );
  end;

  perform public.post_invoice(inv_id);
  perform public.post_invoice(inv2);
  perform public._phase5_record(
    'rpc', 'full remaining closes the SO after post',
    (select status from public.sales_orders where id = so_id) = 'closed',
    (select status::text from public.sales_orders where id = so_id)
  );

  begin
    perform public.create_invoice(jsonb_build_object(
      'sales_order_id', so_id,
      'invoice_number', 'P5-CLOSED',
      'lines', jsonb_build_array(jsonb_build_object('sales_order_item_id', soi_id, 'quantity', 1))
    ));
    perform public._phase5_record('rpc', 'closed SO cannot be invoiced', false, 'invoice succeeded');
  exception
    when others then
      perform public._phase5_record('rpc', 'closed SO cannot be invoiced', sqlerrm ilike '%open%', sqlerrm);
  end;

  so_id := public.create_sales_order(jsonb_build_object(
    'customer_id', cust,
    'lines', jsonb_build_array(jsonb_build_object('item_id', it, 'quantity', 10, 'unit_price', 50))
  ));
  perform public.open_sales_order(so_id);
  select id into soi_id from public.sales_order_items where sales_order_id = so_id;
  inv_id := public.create_invoice(jsonb_build_object(
    'sales_order_id', so_id,
    'invoice_number', 'P5-FULL',
    'lines', jsonb_build_array(jsonb_build_object('sales_order_item_id', soi_id, 'quantity', 10, 'tax_amount', 5))
  ));
  leftover := public.so_item_remaining_qty(soi_id);
  perform public._phase5_record(
    'qty', 'full invoice consumes remaining',
    leftover = 0 and (select grand_total from public.invoices where id = inv_id) = 505,
    leftover::text
  );
end
$$;

\echo
\echo === Phase 5 invoice validation report ===
select
  area,
  check_name,
  case when passed then 'PASS' else 'FAIL' end as status,
  detail
from public._phase5_results
order by id;

\echo
select
  count(*) filter (where passed) as passed,
  count(*) filter (where not passed) as failed,
  count(*) as total
from public._phase5_results;

do $$
declare
  failed int;
begin
  select count(*) into failed from public._phase5_results where not passed;
  drop function public._phase5_record(text, text, boolean, text);
  if failed > 0 then
    raise exception 'Phase 5 invoice validation failed (% checks)', failed;
  end if;
end
$$;
