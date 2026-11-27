-- A bill of lading line must have a shipped quantity greater than zero.
-- Zero and blank quantities are rejected instead of skipped.

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
  mode := coalesce(nullif(payload->>'shipment_mode', '')::public.shipment_mode, 'land');
  bol_no := public.next_doc_number('bill_of_lading', 'BOL-');
  insert into public.bills_of_lading (
    id, bol_number, purchase_order_id, shipment_mode, shipment_date, expected_arrival_date,
    carrier, vessel_name, voyage_number, container_number, seal_number, vehicle_plate_number,
    origin, destination, reference_number, remarks, status, created_by, updated_by
  ) values (
    new_id, bol_no, po.id, mode,
    coalesce((payload->>'shipment_date')::date, (now() at time zone 'Asia/Manila')::date),
    nullif(payload->>'expected_arrival_date', '')::date,
    nullif(btrim(coalesce(payload->>'carrier', '')), ''),
    nullif(btrim(coalesce(payload->>'vessel_name', '')), ''),
    nullif(btrim(coalesce(payload->>'voyage_number', '')), ''),
    nullif(btrim(coalesce(payload->>'container_number', '')), ''),
    nullif(btrim(coalesce(payload->>'seal_number', '')), ''),
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
