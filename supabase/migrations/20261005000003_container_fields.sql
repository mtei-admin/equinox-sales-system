-- Bill of lading stores how many containers shipped.
-- The container number and seal are recorded on the receiving report.

alter table public.bills_of_lading
  add column container_count integer
  check (container_count is null or container_count > 0);

alter table public.receiving_reports
  add column container_number text,
  add column seal_number text;

create or replace function public.create_bill_of_lading(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  po public.purchase_orders%rowtype;
  poi public.purchase_order_items%rowtype;
  line jsonb;
  new_id uuid := gen_random_uuid();
  bol_no text;
  qty numeric;
  i integer := 0;
  mode public.shipment_mode;
  containers integer;
begin
  perform public.require_roles('admin', 'warehouse');
  select * into po from public.purchase_orders where id = (payload->>'purchase_order_id')::uuid for update;
  if po.id is null then
    raise exception 'Purchase order was not found';
  end if;
  if po.status in ('draft', 'for_approval', 'cancelled', 'closed', 'completed') then
    raise exception 'A bill of lading cannot be created for this purchase order';
  end if;
  if not exists (
    select 1 from public.purchase_order_items
    where purchase_order_id = po.id and shipped_qty < ordered_qty
  ) then
    raise exception 'Purchase Order has already been fully shipped.';
  end if;
  if nullif(btrim(coalesce(payload->>'container_count', '')), '') is null then
    containers := null;
  elsif btrim(payload->>'container_count') !~ '^[0-9]+$' or (payload->>'container_count')::integer <= 0 then
    raise exception 'Number of containers must be greater than 0';
  else
    containers := (payload->>'container_count')::integer;
  end if;
  mode := coalesce(nullif(payload->>'shipment_mode', '')::public.shipment_mode, 'land');
  bol_no := public.next_doc_number('bill_of_lading', 'BOL-');
  insert into public.bills_of_lading (
    id, bol_number, purchase_order_id, shipment_mode, shipment_date, expected_arrival_date,
    carrier, vessel_name, voyage_number, container_count, vehicle_plate_number,
    origin, destination, reference_number, remarks, status, created_by, updated_by
  ) values (
    new_id, bol_no, po.id, mode,
    coalesce((payload->>'shipment_date')::date, (now() at time zone 'Asia/Manila')::date),
    nullif(payload->>'expected_arrival_date', '')::date,
    nullif(btrim(coalesce(payload->>'carrier', '')), ''),
    nullif(btrim(coalesce(payload->>'vessel_name', '')), ''),
    nullif(btrim(coalesce(payload->>'voyage_number', '')), ''),
    containers,
    nullif(btrim(coalesce(payload->>'vehicle_plate_number', '')), ''),
    nullif(btrim(coalesce(payload->>'origin', '')), ''),
    nullif(btrim(coalesce(payload->>'destination', '')), ''),
    nullif(btrim(coalesce(payload->>'reference_number', '')), ''),
    nullif(btrim(coalesce(payload->>'remarks', '')), ''),
    'draft', auth.uid(), auth.uid()
  );
  if payload is null or jsonb_typeof(payload->'lines') <> 'array' or jsonb_array_length(payload->'lines') = 0 then
    raise exception 'Bill of lading needs at least one item';
  end if;
  for line in select value from jsonb_array_elements(payload->'lines')
  loop
    if line->>'shipped_qty' is null or btrim(line->>'shipped_qty') = '' then
      raise exception 'Shipped quantity is required';
    end if;
    begin
      qty := public.round_money((line->>'shipped_qty')::numeric);
    exception
      when invalid_text_representation then
        raise exception 'Shipped quantity must be greater than 0';
    end;
    if qty <= 0 then
      raise exception 'Shipped quantity must be greater than 0';
    end if;
    select * into poi from public.purchase_order_items
    where id = (line->>'purchase_order_item_id')::uuid and purchase_order_id = po.id
    for update;
    if poi.id is null then
      raise exception 'Purchase order item was not found';
    end if;
    if qty > public.round_money(poi.ordered_qty - poi.shipped_qty) then
      raise exception 'Requested shipment quantity exceeds the remaining PO quantity.';
    end if;
    i := i + 1;
    insert into public.bill_of_lading_items (
      bill_of_lading_id, purchase_order_item_id, item_id, item_name, model, barcode, uom, shipped_qty, sort_order
    ) values (
      new_id, poi.id, poi.item_id, poi.item_name, poi.model, poi.barcode, poi.uom, qty, i
    );
  end loop;
  if i = 0 then
    raise exception 'Bill of lading needs at least one item';
  end if;
  perform public.record_purchasing_event('bill_of_lading', new_id, bol_no, 'created', null, 'draft', null);
  return new_id;
end;
$$;

create or replace function public.create_receiving_report(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  bol public.bills_of_lading%rowtype;
  bli public.bill_of_lading_items%rowtype;
  po public.purchase_orders%rowtype;
  line jsonb;
  new_id uuid := gen_random_uuid();
  rr_no text;
  good_qty numeric;
  damaged_qty numeric;
  actual numeric;
  expected numeric;
  short_qty numeric;
  excess_qty numeric;
  accept_excess boolean;
  remarks text;
  i integer := 0;
  gross numeric;
  tare numeric;
  net numeric;
  recv_name text;
  check_name text;
  wh uuid;
begin
  perform public.require_roles('admin', 'warehouse');
  select * into bol from public.bills_of_lading where id = (payload->>'bill_of_lading_id')::uuid for update;
  if bol.id is null or bol.status not in ('posted', 'in_transit', 'arrived', 'partially_received') then
    raise exception 'A receiving report can only be created from a posted bill of lading';
  end if;
  select * into po from public.purchase_orders where id = bol.purchase_order_id;
  if po.status in ('closed', 'cancelled', 'draft', 'for_approval') then
    raise exception 'A receiving report cannot be created for this purchase order';
  end if;
  wh := coalesce(nullif(payload->>'warehouse_id', '')::uuid, po.warehouse_id);
  gross := nullif(payload->>'gross_weight', '')::numeric;
  tare := nullif(payload->>'tare_weight', '')::numeric;
  net := nullif(payload->>'net_weight', '')::numeric;
  if gross is not null and tare is not null then
    if tare > gross then
      raise exception 'Tare weight cannot exceed gross weight';
    end if;
    net := public.round_money(gross - tare);
  end if;
  select full_name into recv_name from public.users where id = nullif(payload->>'received_by', '')::uuid;
  select full_name into check_name from public.users where id = nullif(payload->>'checked_by', '')::uuid;
  rr_no := public.next_doc_number('receiving_report', 'RR-');
  insert into public.receiving_reports (
    id, rr_number, bill_of_lading_id, purchase_order_id, warehouse_id, receiving_date,
    delivery_receipt_number, supplier_invoice_number, received_by, received_by_name,
    checked_by, checked_by_name, remarks, gross_weight, tare_weight, net_weight, weighbridge_ticket,
    container_number, seal_number,
    status, created_by, updated_by
  ) values (
    new_id, rr_no, bol.id, po.id, wh,
    coalesce((payload->>'receiving_date')::date, (now() at time zone 'Asia/Manila')::date),
    nullif(btrim(coalesce(payload->>'delivery_receipt_number', '')), ''),
    nullif(btrim(coalesce(payload->>'supplier_invoice_number', '')), ''),
    nullif(payload->>'received_by', '')::uuid, recv_name,
    nullif(payload->>'checked_by', '')::uuid, check_name,
    nullif(btrim(coalesce(payload->>'remarks', '')), ''),
    gross, tare, net,
    nullif(btrim(coalesce(payload->>'weighbridge_ticket', '')), ''),
    nullif(btrim(coalesce(payload->>'container_number', '')), ''),
    nullif(btrim(coalesce(payload->>'seal_number', '')), ''),
    'draft', auth.uid(), auth.uid()
  );
  for line in select value from jsonb_array_elements(coalesce(payload->'lines', '[]'::jsonb))
  loop
    good_qty := public.round_money(coalesce((line->>'good_qty')::numeric, 0));
    damaged_qty := public.round_money(coalesce((line->>'damaged_qty')::numeric, 0));
    actual := public.round_money(good_qty + damaged_qty);
    if actual <= 0 then
      continue;
    end if;
    if good_qty < 0 or damaged_qty < 0 then
      raise exception 'Quantity cannot be negative';
    end if;
    select * into bli from public.bill_of_lading_items
    where id = (line->>'bol_item_id')::uuid and bill_of_lading_id = bol.id
    for update;
    if bli.id is null then
      raise exception 'Bill of lading item was not found';
    end if;
    expected := public.round_money(bli.shipped_qty - bli.received_qty);
    excess_qty := public.round_money(greatest(actual - expected, 0));
    accept_excess := coalesce((line->>'accept_excess')::boolean, false);
    remarks := nullif(btrim(coalesce(line->>'remarks', '')), '');
    if coalesce((line->>'record_short')::boolean, false) and actual < expected then
      short_qty := public.round_money(expected - actual);
    else
      short_qty := 0;
    end if;
    if excess_qty > 0 and not accept_excess then
      raise exception 'Receiving quantity exceeds remaining BOL quantity.';
    end if;
    if (short_qty > 0 or damaged_qty > 0 or excess_qty > 0) and remarks is null then
      raise exception 'Remarks are required for a short, damaged, or excess receipt';
    end if;
    i := i + 1;
    insert into public.receiving_report_items (
      receiving_report_id, bol_item_id, purchase_order_item_id, item_id, item_name, uom,
      shipped_qty, previously_received_qty, actual_received_qty, good_qty, damaged_qty,
      short_qty, excess_qty, record_short, accept_excess, remarks, sort_order
    ) values (
      new_id, bli.id, bli.purchase_order_item_id, bli.item_id, bli.item_name, bli.uom,
      bli.shipped_qty, bli.received_qty, actual, good_qty, damaged_qty,
      short_qty, excess_qty, short_qty > 0, accept_excess, remarks, i
    );
  end loop;
  if i = 0 then
    raise exception 'Receiving report needs at least one received quantity';
  end if;
  perform public.record_purchasing_event('receiving_report', new_id, rr_no, 'created', null, 'draft', null);
  return new_id;
end;
$$;
