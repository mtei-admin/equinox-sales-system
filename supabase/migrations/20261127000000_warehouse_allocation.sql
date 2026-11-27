-- Warehouse commitments are the ATW/DR quantity for that source warehouse
-- that has not yet been issued. Unallocated is the open sales-order
-- commitment that is not on a draft or released ATW/DR.
-- Issuing or cancelling a withdrawal slip changes both figures through the
-- same issued-quantity subtraction, so a commitment is not released twice.

create or replace function public.inventory_reserved(p_warehouse_id uuid, p_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.round_money(coalesce(sum(greatest(
    ati.quantity - coalesce((
      select sum(wsi.quantity)
      from public.withdrawal_slip_items wsi
      join public.withdrawal_slips ws on ws.id = wsi.withdrawal_slip_id
      where wsi.atw_item_id = ati.id
        and ws.status = 'issued'
    ), 0)
  , 0)), 0))
  from public.atw_document_items ati
  join public.atw_documents atw on atw.id = ati.atw_id
  join public.sales_orders so on so.id = atw.sales_order_id
  where ati.item_id = p_item_id
    and atw.warehouse_id = p_warehouse_id
    and atw.status in ('draft', 'released')
    and so.status in ('open', 'closed');
$$;

create or replace function public.inventory_unallocated(p_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.round_money(greatest(
    public.inventory_committed(p_item_id) - coalesce((
      select sum(public.inventory_reserved(w.id, p_item_id))
      from public.warehouses w
      where w.status = 'active'
    ), 0)
  , 0));
$$;

create or replace view public.inventory_company_stock as
select
  i.id as item_id,
  i.name as item_name,
  i.brand,
  i.model,
  i.barcode,
  i.status as item_status,
  public.round_money(coalesce((
    select sum(m.quantity) from public.inventory_movements m where m.item_id = i.id
  ), 0)) as on_hand,
  public.inventory_incoming(i.id) as incoming,
  public.inventory_committed(i.id) as reserved,
  public.round_money(
    coalesce((select sum(m.quantity) from public.inventory_movements m where m.item_id = i.id), 0)
    - public.inventory_committed(i.id)
  ) as available,
  public.inventory_quarantine(i.id) as quarantine,
  public.inventory_unallocated(i.id) as unallocated
from public.items i;

comment on view public.inventory_company_stock is
  'Company on hand, incoming, and committed. Committed counts allocated and unallocated quantity once.';

grant execute on function public.inventory_unallocated(uuid) to authenticated;
grant select on public.inventory_company_stock to authenticated;

create or replace function public.create_atw_document(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  inv public.invoices%rowtype;
  line jsonb;
  ii public.invoice_items%rowtype;
  qty numeric;
  amt numeric;
  i int := 0;
  sum_qty numeric := 0;
  sum_tot numeric := 0;
  remaining numeric;
  leftover numeric;
  dtype public.atw_document_type;
  wh uuid;
begin
  perform public.require_roles('admin', 'sales');

  select * into inv from public.invoices where id = (payload->>'invoice_id')::uuid for update;
  if inv.id is null then
    raise exception 'Invoice not found';
  end if;
  if inv.status is distinct from 'posted' then
    raise exception 'ATW/DR requires a posted invoice';
  end if;
  if coalesce(jsonb_array_length(payload->'lines'), 0) < 1 then
    raise exception 'At least one line is required';
  end if;
  dtype := coalesce((payload->>'document_type')::public.atw_document_type, 'atw');
  wh := nullif(payload->>'warehouse_id', '')::uuid;
  if wh is null then
    wh := inv.warehouse_id;
  elsif not exists (select 1 from public.warehouses where id = wh and status = 'active') then
    raise exception 'Warehouse not found or inactive';
  end if;

  perform 1 from public.invoice_items where invoice_id = inv.id for update;

  select public.round_money(coalesce(sum(line_row.quantity - public.invoice_item_atw_qty(line_row.id)), 0))
  into leftover
  from public.invoice_items as line_row
  where line_row.invoice_id = inv.id;
  if leftover <= 0 then
    raise exception 'Invoice is already fully allocated to ATW/DR';
  end if;

  insert into public.atw_documents (
    atw_number, warehouse_id, document_type, invoice_id, sales_order_id, customer_id, customer_name, delivery_address,
    order_date, term, reference_no, order_type, sales_employee_id, sales_employee_name, remarks, created_by, updated_by
  ) values (
    public.next_doc_number('atw', 'ATW-'),
    wh,
    dtype, inv.id, inv.sales_order_id, inv.customer_id, inv.customer_name, inv.delivery_address,
    inv.order_date, inv.term, inv.reference_no, inv.order_type, inv.sales_employee_id, inv.sales_employee_name,
    payload->>'remarks', auth.uid(), auth.uid()
  ) returning id into new_id;

  for line in select * from jsonb_array_elements(payload->'lines')
  loop
    i := i + 1;
    select * into ii from public.invoice_items where id = (line->>'invoice_item_id')::uuid;
    if ii.id is null or ii.invoice_id <> inv.id then
      raise exception 'ATW line does not belong to the invoice';
    end if;
    qty := (line->>'quantity')::numeric;
    if qty is null or qty <= 0 then
      raise exception 'Quantity must be greater than 0';
    end if;
    remaining := public.round_money(ii.quantity - public.invoice_item_atw_qty(ii.id));
    if qty > remaining then
      raise exception 'ATW quantity % exceeds remaining %', qty, remaining;
    end if;
    amt := public.round_money(qty * ii.unit_price);
    sum_qty := sum_qty + qty;
    sum_tot := sum_tot + amt;
    insert into public.atw_document_items (
      atw_id, invoice_item_id, sales_order_item_id, item_id, model, serial_no, barcode, description,
      invoice_item_quantity, quantity, uom, unit_price, amount, total_amount, sort_order
    ) values (
      new_id, ii.id, ii.sales_order_item_id, ii.item_id, ii.model, ii.serial_no, ii.barcode, ii.description,
      ii.quantity, qty, ii.uom, ii.unit_price, amt, amt, i
    );
  end loop;

  update public.atw_documents
  set total_quantity = public.round_money(sum_qty), grand_total = public.round_money(sum_tot)
  where id = new_id;
  return new_id;
end;
$$;

create or replace function public.issue_withdrawal_slip(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ws public.withdrawal_slips%rowtype;
  atw_wh uuid;
  rec record;
  on_hand numeric;
  allocated numeric;
  signed_qty numeric;
begin
  perform public.require_roles('admin', 'warehouse');
  select * into ws from public.withdrawal_slips where id = p_id for update;
  if ws.status is distinct from 'draft' then
    raise exception 'Only a draft withdrawal slip can be issued';
  end if;

  select warehouse_id into atw_wh from public.atw_documents where id = ws.atw_id for update;
  if atw_wh is distinct from ws.warehouse_id then
    raise exception 'Withdrawal slip warehouse must match the ATW/DR source warehouse';
  end if;

  perform 1 from public.items
  where id in (select item_id from public.withdrawal_slip_items where withdrawal_slip_id = p_id)
  for update;
  perform 1 from public.atw_document_items where atw_id = ws.atw_id for update;

  for rec in
    select wsi.item_id, public.round_money(sum(wsi.quantity)) as qty
    from public.withdrawal_slip_items wsi
    where wsi.withdrawal_slip_id = p_id
    group by wsi.item_id
  loop
    on_hand := public.inventory_on_hand(ws.warehouse_id, rec.item_id);
    allocated := public.inventory_reserved(ws.warehouse_id, rec.item_id);
    if rec.qty > on_hand then
      raise exception 'On-hand quantity % is less than withdrawal %', on_hand, rec.qty;
    end if;
    if rec.qty > allocated then
      raise exception 'Withdrawal quantity % exceeds the warehouse allocation %', rec.qty, allocated;
    end if;
  end loop;

  for rec in
    select id, item_id, quantity
    from public.withdrawal_slip_items
    where withdrawal_slip_id = p_id
  loop
    signed_qty := public.round_money(rec.quantity * -1);
    insert into public.inventory_movements (
      warehouse_id, item_id, quantity, source_type, source_id, source_line_id
    ) values (
      ws.warehouse_id, rec.item_id, signed_qty, 'withdrawal_slip', p_id, rec.id
    );
  end loop;

  update public.withdrawal_slips set status = 'issued', updated_by = auth.uid() where id = p_id;
end;
$$;

create or replace function public.create_withdrawal_slip(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  atw public.atw_documents%rowtype;
  line_row public.atw_document_items%rowtype;
  amt numeric;
  i int := 0;
  sum_qty numeric := 0;
  sum_tot numeric := 0;
  has_slip boolean;
  expected_n int;
  line jsonb;
  expected_qty numeric;
  wh uuid;
begin
  perform public.require_roles('admin', 'warehouse');

  select * into atw from public.atw_documents where id = (payload->>'atw_id')::uuid for update;
  if atw.id is null then
    raise exception 'ATW/DR not found';
  end if;
  if atw.status is distinct from 'released' then
    raise exception 'Withdrawal slip requires a released ATW/DR';
  end if;

  perform 1 from public.atw_document_items where atw_id = atw.id for update;

  select exists (
    select 1
    from public.withdrawal_slips as slip
    where slip.atw_id = atw.id
      and slip.status <> 'cancelled'
  ) into has_slip;
  if has_slip then
    raise exception 'This ATW/DR already has a withdrawal slip';
  end if;

  select count(*) into expected_n from public.atw_document_items where atw_id = atw.id;
  if expected_n < 1 then
    raise exception 'ATW/DR has no lines';
  end if;

  if jsonb_typeof(payload->'lines') = 'array' and jsonb_array_length(payload->'lines') > 0 then
    if jsonb_array_length(payload->'lines') <> expected_n then
      raise exception 'Withdrawal slip must copy every ATW/DR line';
    end if;
    for line in select * from jsonb_array_elements(payload->'lines')
    loop
      select quantity into expected_qty
      from public.atw_document_items as src
      where src.id = (line->>'atw_item_id')::uuid
        and src.atw_id = atw.id;
      if expected_qty is null then
        raise exception 'Withdrawal slip is missing an ATW/DR line';
      end if;
      if (line->>'quantity')::numeric is distinct from expected_qty then
        raise exception 'Withdrawal slip quantity % must match ATW/DR quantity %',
          (line->>'quantity')::numeric, expected_qty;
      end if;
    end loop;
  end if;

  wh := nullif(payload->>'warehouse_id', '')::uuid;
  if wh is null then
    wh := atw.warehouse_id;
  elsif wh is distinct from atw.warehouse_id then
    raise exception 'Withdrawal slip warehouse must match the ATW/DR source warehouse';
  end if;

  insert into public.withdrawal_slips (
    ws_number, warehouse_id, atw_id, invoice_id, sales_order_id, customer_id, customer_name, delivery_address,
    order_date, term, reference_no, order_type, sales_employee_id, sales_employee_name, remarks, created_by, updated_by
  ) values (
    public.next_doc_number('withdrawal_slip', 'WS-'),
    wh,
    atw.id, atw.invoice_id, atw.sales_order_id, atw.customer_id, atw.customer_name, atw.delivery_address,
    atw.order_date, atw.term, atw.reference_no, atw.order_type, atw.sales_employee_id, atw.sales_employee_name,
    payload->>'remarks', auth.uid(), auth.uid()
  ) returning id into new_id;

  for line_row in select * from public.atw_document_items where atw_id = atw.id order by sort_order
  loop
    i := i + 1;
    amt := public.round_money(line_row.quantity * line_row.unit_price);
    sum_qty := sum_qty + line_row.quantity;
    sum_tot := sum_tot + amt;
    insert into public.withdrawal_slip_items (
      withdrawal_slip_id, atw_item_id, invoice_item_id, sales_order_item_id, item_id,
      model, serial_no, barcode, description, quantity, uom, amount, total_amount, sort_order
    ) values (
      new_id, line_row.id, line_row.invoice_item_id, line_row.sales_order_item_id, line_row.item_id,
      line_row.model, line_row.serial_no, line_row.barcode, line_row.description,
      line_row.quantity, line_row.uom, amt, amt, i
    );
  end loop;

  update public.withdrawal_slips
  set total_quantity = public.round_money(sum_qty), grand_total = public.round_money(sum_tot)
  where id = new_id;
  return new_id;
exception
  when unique_violation then
    raise exception 'This ATW/DR already has a withdrawal slip';
end;
$$;
