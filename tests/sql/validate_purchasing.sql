-- Purchasing: supplier → PO → BOL → receiving report → inventory ledger.
-- Apply after validate_inventory.sql.

drop table if exists public._phase_pur_results;
create table public._phase_pur_results (
  id serial primary key,
  area text not null,
  check_name text not null,
  passed boolean not null,
  detail text not null default ''
);

create or replace function public._phase_pur_record(p_area text, p_name text, p_pass boolean, p_detail text default '')
returns void
language sql
as $$
  insert into public._phase_pur_results (area, check_name, passed, detail)
  values (p_area, p_name, p_pass, coalesce(p_detail, ''));
$$;

do $$
declare
  admin_id uuid;
  sales_id uuid;
  wh uuid := public.default_warehouse_id();
  item_id uuid;
  supplier_id uuid;
  po uuid;
  bol uuid;
  bol2 uuid;
  rr uuid;
  rr2 uuid;
  st text;
  on_hand numeric;
  before_qty numeric;
  mov_count integer;
  rev_count integer;
  disc_status text;
begin
  select id into admin_id from public.users where role = 'admin' and status = 'active' limit 1;
  select id into sales_id from public.users where role = 'sales' and status = 'active' limit 1;

  insert into public.items (name, description, status)
  values ('Purchasing test item', 'Used by purchasing SQL checks', 'active')
  returning id into item_id;

  insert into public.suppliers (supplier_code, name, status)
  values ('', 'Purchasing test supplier', 'active')
  returning id into supplier_id;

  perform public._phase_pur_record(
    'master', 'supplier code assigned',
    exists (select 1 from public.suppliers where id = supplier_id and supplier_code like 'SUP-%'),
    (select supplier_code from public.suppliers where id = supplier_id)
  );

  perform set_config('request.jwt.claim.sub', sales_id::text, true);
  begin
    perform public.create_purchase_order(jsonb_build_object(
      'supplier_id', supplier_id,
      'lines', jsonb_build_array(jsonb_build_object('item_id', item_id, 'ordered_qty', 1, 'unit_cost', 1))
    ));
    perform public._phase_pur_record('auth', 'sales cannot create PO', false, 'create succeeded');
  exception
    when others then
      perform public._phase_pur_record('auth', 'sales cannot create PO', sqlerrm ilike '%Not authorized%', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);

  -- Scenario 1: full ship / full receipt
  before_qty := public.inventory_on_hand(wh, item_id);
  po := public.create_purchase_order(jsonb_build_object(
    'supplier_id', supplier_id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', item_id, 'ordered_qty', 1000, 'unit_cost', 2, 'uom', 'BAG'))
  ));
  perform public.submit_purchase_order(po);
  perform public.approve_purchase_order(po);
  perform public._phase_pur_record(
    's1', 'approval does not move stock',
    public.inventory_on_hand(wh, item_id) = before_qty,
    format('on_hand=%s', public.inventory_on_hand(wh, item_id))
  );
  bol := public.create_bill_of_lading(jsonb_build_object(
    'purchase_order_id', po,
    'shipment_mode', 'land',
    'lines', (
      select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 1000))
      from public.purchase_order_items where purchase_order_id = po
    )
  ));
  perform public.post_bill_of_lading(bol);
  perform public._phase_pur_record(
    's1', 'posted BOL does not move stock',
    public.inventory_on_hand(wh, item_id) = before_qty
      and (select status from public.purchase_orders where id = po) = 'fully_shipped',
    (select status::text from public.purchase_orders where id = po)
  );
  rr := public.create_receiving_report(jsonb_build_object(
    'bill_of_lading_id', bol,
    'lines', (
      select jsonb_agg(jsonb_build_object('bol_item_id', id, 'good_qty', 1000, 'damaged_qty', 0))
      from public.bill_of_lading_items where bill_of_lading_id = bol
    )
  ));
  perform public.post_receiving_report(rr);
  perform public._phase_pur_record(
    's1', 'full receipt adds good qty and completes PO',
    public.inventory_on_hand(wh, item_id) = before_qty + 1000
      and (select status from public.purchase_orders where id = po) = 'completed'
      and (select status from public.bills_of_lading where id = bol) = 'fully_received',
    format('on_hand=%s po=%s bol=%s', public.inventory_on_hand(wh, item_id),
      (select status from public.purchase_orders where id = po),
      (select status from public.bills_of_lading where id = bol))
  );

  -- Scenario 2: partial shipment cannot exceed ordered
  po := public.create_purchase_order(jsonb_build_object(
    'supplier_id', supplier_id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', item_id, 'ordered_qty', 1000, 'unit_cost', 1))
  ));
  perform public.submit_purchase_order(po);
  perform public.approve_purchase_order(po);
  bol := public.create_bill_of_lading(jsonb_build_object(
    'purchase_order_id', po, 'shipment_mode', 'sea',
    'lines', (select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 600)) from public.purchase_order_items where purchase_order_id = po)
  ));
  perform public.post_bill_of_lading(bol);
  bol2 := public.create_bill_of_lading(jsonb_build_object(
    'purchase_order_id', po, 'shipment_mode', 'land',
    'lines', (select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 400)) from public.purchase_order_items where purchase_order_id = po)
  ));
  perform public.post_bill_of_lading(bol2);
  begin
    perform public.create_bill_of_lading(jsonb_build_object(
      'purchase_order_id', po, 'shipment_mode', 'land',
      'lines', (select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 1)) from public.purchase_order_items where purchase_order_id = po)
    ));
    perform public._phase_pur_record('s2', 'third shipment rejected', false, 'create succeeded');
  exception
    when others then
      perform public._phase_pur_record('s2', 'third shipment rejected', sqlerrm ilike '%fully shipped%', sqlerrm);
  end;
  perform public._phase_pur_record(
    's2', '600 + 400 ships the PO',
    (select shipped_qty from public.purchase_order_items where purchase_order_id = po) = 1000
      and (select status from public.purchase_orders where id = po) = 'fully_shipped',
    (select status::text from public.purchase_orders where id = po)
  );

  -- Scenario 3: partial receiving
  po := public.create_purchase_order(jsonb_build_object(
    'supplier_id', supplier_id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', item_id, 'ordered_qty', 600, 'unit_cost', 1))
  ));
  perform public.submit_purchase_order(po);
  perform public.approve_purchase_order(po);
  bol := public.create_bill_of_lading(jsonb_build_object(
    'purchase_order_id', po, 'shipment_mode', 'land',
    'lines', (select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 600)) from public.purchase_order_items where purchase_order_id = po)
  ));
  perform public.post_bill_of_lading(bol);
  rr := public.create_receiving_report(jsonb_build_object(
    'bill_of_lading_id', bol,
    'lines', (select jsonb_agg(jsonb_build_object('bol_item_id', id, 'good_qty', 300, 'damaged_qty', 0)) from public.bill_of_lading_items where bill_of_lading_id = bol)
  ));
  perform public.post_receiving_report(rr);
  perform public._phase_pur_record(
    's3', 'first receipt leaves BOL partial',
    (select status from public.bills_of_lading where id = bol) = 'partially_received',
    (select status::text from public.bills_of_lading where id = bol)
  );
  rr2 := public.create_receiving_report(jsonb_build_object(
    'bill_of_lading_id', bol,
    'lines', (select jsonb_agg(jsonb_build_object('bol_item_id', id, 'good_qty', 300, 'damaged_qty', 0)) from public.bill_of_lading_items where bill_of_lading_id = bol)
  ));
  perform public.post_receiving_report(rr2);
  perform public._phase_pur_record(
    's3', 'second receipt completes BOL and PO',
    (select status from public.bills_of_lading where id = bol) = 'fully_received'
      and (select status from public.purchase_orders where id = po) = 'completed',
    format('bol=%s po=%s', (select status from public.bills_of_lading where id = bol), (select status from public.purchase_orders where id = po))
  );

  -- Scenario 4: short delivery
  before_qty := public.inventory_on_hand(wh, item_id);
  po := public.create_purchase_order(jsonb_build_object(
    'supplier_id', supplier_id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', item_id, 'ordered_qty', 600, 'unit_cost', 1))
  ));
  perform public.submit_purchase_order(po);
  perform public.approve_purchase_order(po);
  bol := public.create_bill_of_lading(jsonb_build_object(
    'purchase_order_id', po, 'shipment_mode', 'land',
    'lines', (select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 600)) from public.purchase_order_items where purchase_order_id = po)
  ));
  perform public.post_bill_of_lading(bol);
  rr := public.create_receiving_report(jsonb_build_object(
    'bill_of_lading_id', bol,
    'lines', (select jsonb_agg(jsonb_build_object('bol_item_id', id, 'good_qty', 590, 'damaged_qty', 0, 'remarks', 'short 10', 'record_short', true)) from public.bill_of_lading_items where bill_of_lading_id = bol)
  ));
  perform public.post_receiving_report(rr);
  select d.status::text into disc_status
  from public.receiving_discrepancies d
  join public.receiving_report_items ri on ri.id = d.receiving_report_item_id
  where ri.receiving_report_id = rr and d.discrepancy_type = 'short';
  perform public._phase_pur_record(
    's4', 'short stays open and stock uses good qty',
    public.inventory_on_hand(wh, item_id) = before_qty + 590
      and disc_status = 'open'
      and (select shipped_qty from public.bill_of_lading_items where bill_of_lading_id = bol) = 600
      and (select status from public.purchase_orders where id = po) <> 'completed',
    format('on_hand_delta=%s disc=%s po=%s', public.inventory_on_hand(wh, item_id) - before_qty, disc_status, (select status from public.purchase_orders where id = po))
  );

  -- Scenario 5: damaged
  before_qty := public.inventory_on_hand(wh, item_id);
  po := public.create_purchase_order(jsonb_build_object(
    'supplier_id', supplier_id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', item_id, 'ordered_qty', 600, 'unit_cost', 1))
  ));
  perform public.submit_purchase_order(po);
  perform public.approve_purchase_order(po);
  bol := public.create_bill_of_lading(jsonb_build_object(
    'purchase_order_id', po, 'shipment_mode', 'land',
    'lines', (select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 600)) from public.purchase_order_items where purchase_order_id = po)
  ));
  perform public.post_bill_of_lading(bol);
  rr := public.create_receiving_report(jsonb_build_object(
    'bill_of_lading_id', bol,
    'lines', (select jsonb_agg(jsonb_build_object('bol_item_id', id, 'good_qty', 590, 'damaged_qty', 10, 'remarks', '10 damaged')) from public.bill_of_lading_items where bill_of_lading_id = bol)
  ));
  perform public.post_receiving_report(rr);
  perform public._phase_pur_record(
    's5', 'damaged qty is not usable stock',
    public.inventory_on_hand(wh, item_id) = before_qty + 590
      and exists (
        select 1 from public.receiving_discrepancies d
        join public.receiving_report_items ri on ri.id = d.receiving_report_item_id
        where ri.receiving_report_id = rr and d.discrepancy_type = 'damaged' and d.quantity = 10 and d.status = 'open'
      ),
    format('delta=%s', public.inventory_on_hand(wh, item_id) - before_qty)
  );

  -- Scenario 6: excess
  before_qty := public.inventory_on_hand(wh, item_id);
  po := public.create_purchase_order(jsonb_build_object(
    'supplier_id', supplier_id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', item_id, 'ordered_qty', 600, 'unit_cost', 1))
  ));
  perform public.submit_purchase_order(po);
  perform public.approve_purchase_order(po);
  bol := public.create_bill_of_lading(jsonb_build_object(
    'purchase_order_id', po, 'shipment_mode', 'land',
    'lines', (select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 600)) from public.purchase_order_items where purchase_order_id = po)
  ));
  perform public.post_bill_of_lading(bol);
  begin
    perform public.create_receiving_report(jsonb_build_object(
      'bill_of_lading_id', bol,
      'lines', (select jsonb_agg(jsonb_build_object('bol_item_id', id, 'good_qty', 605, 'damaged_qty', 0)) from public.bill_of_lading_items where bill_of_lading_id = bol)
    ));
    perform public._phase_pur_record('s6', 'unaccepted excess rejected', false, 'create succeeded');
  exception
    when others then
      perform public._phase_pur_record('s6', 'unaccepted excess rejected', sqlerrm ilike '%remaining BOL%', sqlerrm);
  end;
  rr := public.create_receiving_report(jsonb_build_object(
    'bill_of_lading_id', bol,
    'lines', (select jsonb_agg(jsonb_build_object('bol_item_id', id, 'good_qty', 605, 'damaged_qty', 0, 'accept_excess', true, 'remarks', 'excess 5')) from public.bill_of_lading_items where bill_of_lading_id = bol)
  ));
  perform public.post_receiving_report(rr);
  perform public._phase_pur_record(
    's6', 'accepted excess is stocked and stays open',
    public.inventory_on_hand(wh, item_id) = before_qty + 605
      and exists (
        select 1 from public.receiving_discrepancies d
        join public.receiving_report_items ri on ri.id = d.receiving_report_item_id
        where ri.receiving_report_id = rr and d.discrepancy_type = 'excess' and d.quantity = 5 and d.status = 'open'
      )
      and (select status from public.purchase_orders where id = po) <> 'completed',
    format('delta=%s po=%s', public.inventory_on_hand(wh, item_id) - before_qty, (select status from public.purchase_orders where id = po))
  );

  -- Scenario 7: double post
  before_qty := public.inventory_on_hand(wh, item_id);
  po := public.create_purchase_order(jsonb_build_object(
    'supplier_id', supplier_id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', item_id, 'ordered_qty', 100, 'unit_cost', 1))
  ));
  perform public.submit_purchase_order(po);
  perform public.approve_purchase_order(po);
  bol := public.create_bill_of_lading(jsonb_build_object(
    'purchase_order_id', po, 'shipment_mode', 'land',
    'lines', (select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 100)) from public.purchase_order_items where purchase_order_id = po)
  ));
  perform public.post_bill_of_lading(bol);
  rr := public.create_receiving_report(jsonb_build_object(
    'bill_of_lading_id', bol,
    'lines', (select jsonb_agg(jsonb_build_object('bol_item_id', id, 'good_qty', 100, 'damaged_qty', 0)) from public.bill_of_lading_items where bill_of_lading_id = bol)
  ));
  perform public.post_receiving_report(rr);
  begin
    perform public.post_receiving_report(rr);
    perform public._phase_pur_record('s7', 'second post rejected', false, 'post succeeded');
  exception
    when others then
      perform public._phase_pur_record('s7', 'second post rejected', sqlerrm ilike '%already been posted%', sqlerrm);
  end;
  select count(*) into mov_count from public.inventory_movements where source_type = 'receiving_report' and source_id = rr and quantity > 0;
  perform public._phase_pur_record(
    's7', 'stock increases once',
    public.inventory_on_hand(wh, item_id) = before_qty + 100 and mov_count = 1,
    format('delta=%s movements=%s', public.inventory_on_hand(wh, item_id) - before_qty, mov_count)
  );

  -- Scenario 8: two drafts of the same remaining qty; only one post succeeds
  po := public.create_purchase_order(jsonb_build_object(
    'supplier_id', supplier_id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', item_id, 'ordered_qty', 500, 'unit_cost', 1))
  ));
  perform public.submit_purchase_order(po);
  perform public.approve_purchase_order(po);
  bol := public.create_bill_of_lading(jsonb_build_object(
    'purchase_order_id', po, 'shipment_mode', 'land',
    'lines', (select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 500)) from public.purchase_order_items where purchase_order_id = po)
  ));
  bol2 := public.create_bill_of_lading(jsonb_build_object(
    'purchase_order_id', po, 'shipment_mode', 'land',
    'lines', (select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 500)) from public.purchase_order_items where purchase_order_id = po)
  ));
  perform public.post_bill_of_lading(bol);
  begin
    perform public.post_bill_of_lading(bol2);
    perform public._phase_pur_record('s8', 'second BOL post rejected', false, 'post succeeded');
  exception
    when others then
      perform public._phase_pur_record('s8', 'second BOL post rejected', sqlerrm ilike '%Available quantity has changed%', sqlerrm);
  end;
  perform public._phase_pur_record(
    's8', 'shipped qty stays at ordered qty',
    (select shipped_qty from public.purchase_order_items where purchase_order_id = po) = 500,
    (select shipped_qty::text from public.purchase_order_items where purchase_order_id = po)
  );

  -- Scenario 9: cancel posted RR reverses stock and keeps both movements
  before_qty := public.inventory_on_hand(wh, item_id);
  po := public.create_purchase_order(jsonb_build_object(
    'supplier_id', supplier_id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', item_id, 'ordered_qty', 500, 'unit_cost', 1))
  ));
  perform public.submit_purchase_order(po);
  perform public.approve_purchase_order(po);
  bol := public.create_bill_of_lading(jsonb_build_object(
    'purchase_order_id', po, 'shipment_mode', 'land',
    'lines', (select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 500)) from public.purchase_order_items where purchase_order_id = po)
  ));
  perform public.post_bill_of_lading(bol);
  rr := public.create_receiving_report(jsonb_build_object(
    'bill_of_lading_id', bol,
    'lines', (select jsonb_agg(jsonb_build_object('bol_item_id', id, 'good_qty', 500, 'damaged_qty', 0)) from public.bill_of_lading_items where bill_of_lading_id = bol)
  ));
  perform public.post_receiving_report(rr);
  perform public.cancel_receiving_report(rr, 'put back');
  select count(*) into mov_count from public.inventory_movements where source_id = rr and quantity > 0 and reverses_movement_id is null;
  select count(*) into rev_count from public.inventory_movements where source_id = rr and quantity < 0 and reverses_movement_id is not null;
  perform public._phase_pur_record(
    's9', 'cancel reverses stock and keeps history',
    public.inventory_on_hand(wh, item_id) = before_qty
      and (select status from public.receiving_reports where id = rr) = 'cancelled'
      and mov_count = 1 and rev_count = 1,
    format('on_hand=%s original=%s reversal=%s', public.inventory_on_hand(wh, item_id), mov_count, rev_count)
  );

  -- Scenario 10: unresolved short does not complete the PO
  po := public.create_purchase_order(jsonb_build_object(
    'supplier_id', supplier_id,
    'lines', jsonb_build_array(jsonb_build_object('item_id', item_id, 'ordered_qty', 10000, 'unit_cost', 1))
  ));
  perform public.submit_purchase_order(po);
  perform public.approve_purchase_order(po);
  bol := public.create_bill_of_lading(jsonb_build_object(
    'purchase_order_id', po, 'shipment_mode', 'sea',
    'lines', (select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 6000)) from public.purchase_order_items where purchase_order_id = po)
  ));
  perform public.post_bill_of_lading(bol);
  rr := public.create_receiving_report(jsonb_build_object(
    'bill_of_lading_id', bol,
    'lines', (select jsonb_agg(jsonb_build_object('bol_item_id', id, 'good_qty', 5980, 'damaged_qty', 0, 'remarks', 'short 20', 'record_short', true)) from public.bill_of_lading_items where bill_of_lading_id = bol)
  ));
  perform public.post_receiving_report(rr);
  bol2 := public.create_bill_of_lading(jsonb_build_object(
    'purchase_order_id', po, 'shipment_mode', 'land',
    'lines', (select jsonb_agg(jsonb_build_object('purchase_order_item_id', id, 'shipped_qty', 4000)) from public.purchase_order_items where purchase_order_id = po)
  ));
  perform public.post_bill_of_lading(bol2);
  rr2 := public.create_receiving_report(jsonb_build_object(
    'bill_of_lading_id', bol2,
    'lines', (select jsonb_agg(jsonb_build_object('bol_item_id', id, 'good_qty', 4000, 'damaged_qty', 0)) from public.bill_of_lading_items where bill_of_lading_id = bol2)
  ));
  perform public.post_receiving_report(rr2);
  select status::text into st from public.purchase_orders where id = po;
  perform public._phase_pur_record(
    's10', 'unresolved short does not complete PO',
    st <> 'completed' and st = 'partially_received',
    st
  );
  perform public.resolve_receiving_discrepancy(
    (select d.id from public.receiving_discrepancies d
      join public.receiving_report_items ri on ri.id = d.receiving_report_item_id
      where ri.receiving_report_id = rr and d.discrepancy_type = 'short'),
    'accepted',
    'supplier will not replace; shortage accepted'
  );
  perform public._phase_pur_record(
    's10', 'accepted short can complete PO',
    (select status from public.purchase_orders where id = po) = 'completed',
    (select status::text from public.purchase_orders where id = po)
  );

  if exists (select 1 from public._phase_pur_results where passed = false) then
    raise exception 'purchasing validation failed: %',
      (select string_agg(check_name || ': ' || detail, '; ') from public._phase_pur_results where passed = false);
  end if;
end
$$;
