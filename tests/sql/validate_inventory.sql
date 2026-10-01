-- Inventory: on-hand, reserved, available, adjustments, WS issue/cancel.
-- Apply after opening_stock.sql and earlier phase validators.

drop table if exists public._phase_inv_results;
create table public._phase_inv_results (
  id serial primary key,
  area text not null,
  check_name text not null,
  passed boolean not null,
  detail text not null default ''
);

create or replace function public._phase_inv_record(p_area text, p_name text, p_pass boolean, p_detail text default '')
returns void
language sql
as $$
  insert into public._phase_inv_results (area, check_name, passed, detail)
  values (p_area, p_name, p_pass, coalesce(p_detail, ''));
$$;

do $$
declare
  admin_id uuid;
  sales_id uuid;
  wh_id uuid;
  acct_id uuid;
  cust uuid;
  it uuid;
  bare uuid;
  adj uuid;
  so_id uuid;
  soi_id uuid;
  inv_id uuid;
  invi_id uuid;
  atw_id uuid;
  ws_id uuid;
  on_hand numeric;
  reserved numeric;
  avail numeric;
  wh uuid := public.default_warehouse_id();
begin
  perform public._phase_inv_record(
    'catalog', 'inventory tables exist',
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'warehouses')
      and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'inventory_movements')
      and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'inventory_adjustments'),
    'ok'
  );

  select id into admin_id from public.users where role = 'admin' and status = 'active' limit 1;
  select id into sales_id from public.users where role = 'sales' and status = 'active' limit 1;
  select id into wh_id from public.users where role = 'warehouse' and status = 'active' limit 1;
  select id into acct_id from public.users where role = 'accounting' and status = 'active' limit 1;
  select id into cust from public.customers where name = 'Northwind Trading';
  select id into it from public.items where name = 'Steel pipe 2in';

  insert into public.items (name, description, status)
  values ('Bare stock item', 'No opening stock', 'active')
  returning id into bare;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  so_id := public.create_sales_order(jsonb_build_object(
    'customer_id', cust,
    'lines', jsonb_build_array(jsonb_build_object('item_id', bare, 'quantity', 2, 'unit_price', 1))
  ));
  begin
    perform public.open_sales_order(so_id);
    perform public._phase_inv_record('qty', 'open SO blocked when available is 0', false, 'open succeeded');
  exception
    when others then
      perform public._phase_inv_record(
        'qty', 'open SO blocked when available is 0',
        sqlerrm ilike '%available%',
        sqlerrm
      );
  end;

  perform set_config('request.jwt.claim.sub', acct_id::text, true);
  begin
    perform public.create_inventory_adjustment(jsonb_build_object(
      'lines', jsonb_build_array(jsonb_build_object('item_id', it, 'quantity', 1, 'direction', 'increase'))
    ));
    perform public._phase_inv_record('rpc', 'accounting cannot create adjustment', false, 'RPC succeeded');
  exception
    when others then
      perform public._phase_inv_record('rpc', 'accounting cannot create adjustment', sqlerrm ilike '%not authorized%', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', wh_id::text, true);
  adj := public.create_inventory_adjustment(jsonb_build_object(
    'remarks', 'Pipe opening',
    'lines', jsonb_build_array(jsonb_build_object('item_id', bare, 'quantity', 5, 'direction', 'increase'))
  ));
  perform public.post_inventory_adjustment(adj, 'Opening');
  avail := public.inventory_available(wh, bare);
  perform public._phase_inv_record('qty', 'posted increase raises available', avail = 5, avail::text);

  begin
    perform public.post_inventory_adjustment(adj, 'again');
    perform public._phase_inv_record('rpc', 'posted adjustment cannot post again', false, 'posted twice');
  exception
    when others then
      perform public._phase_inv_record('rpc', 'posted adjustment cannot post again', sqlerrm ilike '%draft%', sqlerrm);
  end;

  adj := public.create_inventory_adjustment(jsonb_build_object(
    'lines', jsonb_build_array(jsonb_build_object('item_id', bare, 'quantity', 6, 'direction', 'decrease'))
  ));
  begin
    perform public.post_inventory_adjustment(adj, 'Too much');
    perform public._phase_inv_record('qty', 'decrease cannot exceed available', false, 'decrease posted');
  exception
    when others then
      perform public._phase_inv_record('qty', 'decrease cannot exceed available', sqlerrm ilike '%available%', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  so_id := public.create_sales_order(jsonb_build_object(
    'customer_id', cust,
    'lines', jsonb_build_array(jsonb_build_object('item_id', bare, 'quantity', 3, 'unit_price', 10))
  ));
  perform public.open_sales_order(so_id);
  reserved := public.inventory_reserved(wh, bare);
  avail := public.inventory_available(wh, bare);
  on_hand := public.inventory_on_hand(wh, bare);
  perform public._phase_inv_record(
    'qty', 'open SO reserves quantity',
    on_hand = 5 and reserved = 3 and avail = 2,
    format('on_hand=%s reserved=%s available=%s', on_hand, reserved, avail)
  );

  select id into soi_id from public.sales_order_items where sales_order_id = so_id;
  inv_id := public.create_invoice(jsonb_build_object(
    'sales_order_id', so_id,
    'invoice_number', 'INV-STOCK-1',
    'lines', jsonb_build_array(jsonb_build_object('sales_order_item_id', soi_id, 'quantity', 3, 'tax_amount', 0))
  ));
  perform public.post_invoice(inv_id);
  reserved := public.inventory_reserved(wh, bare);
  perform public._phase_inv_record('qty', 'invoice does not change reserved', reserved = 3, reserved::text);

  select id into invi_id from public.invoice_items where invoice_id = inv_id;
  atw_id := public.create_atw_document(jsonb_build_object(
    'invoice_id', inv_id,
    'document_type', 'atw',
    'lines', jsonb_build_array(jsonb_build_object('invoice_item_id', invi_id, 'quantity', 3))
  ));
  perform public.release_atw_document(atw_id);

  perform set_config('request.jwt.claim.sub', wh_id::text, true);
  ws_id := public.create_withdrawal_slip(jsonb_build_object('atw_id', atw_id));
  reserved := public.inventory_reserved(wh, bare);
  on_hand := public.inventory_on_hand(wh, bare);
  perform public._phase_inv_record(
    'qty', 'draft WS does not move stock',
    on_hand = 5 and reserved = 3,
    format('on_hand=%s reserved=%s', on_hand, reserved)
  );

  perform public.issue_withdrawal_slip(ws_id);
  on_hand := public.inventory_on_hand(wh, bare);
  reserved := public.inventory_reserved(wh, bare);
  avail := public.inventory_available(wh, bare);
  perform public._phase_inv_record(
    'qty', 'issued WS drops on-hand and reserved',
    on_hand = 2 and reserved = 0 and avail = 2,
    format('on_hand=%s reserved=%s available=%s', on_hand, reserved, avail)
  );

  perform public.cancel_withdrawal_slip(ws_id, 'put back');
  on_hand := public.inventory_on_hand(wh, bare);
  reserved := public.inventory_reserved(wh, bare);
  perform public._phase_inv_record(
    'qty', 'cancel issued WS restores on-hand and reserved',
    on_hand = 5 and reserved = 3,
    format('on_hand=%s reserved=%s', on_hand, reserved)
  );

  if exists (select 1 from public._phase_inv_results where passed = false) then
    raise exception 'inventory validation failed: %',
      (select string_agg(check_name || ': ' || detail, '; ') from public._phase_inv_results where passed = false);
  end if;
end
$$;
