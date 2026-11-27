-- Branch warehouses, company-wide commitments, and incoming stock.
-- Existing Main balances stay on Main. This migration does not move stock
-- and does not assign a unit to a warehouse.

insert into public.warehouses (name, status)
select v.name, 'active'::public.master_status
from (values ('DAVAO'), ('CAGAYAN DE ORO'), ('CEBU'), ('MANILA')) as v(name)
where not exists (
  select 1 from public.warehouses w where w.name = v.name
);

-- Same formula as inventory_reserved, without a warehouse filter.
-- Open and closed sales orders commit quantity until an issued withdrawal slip releases it.
create or replace function public.inventory_committed(p_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.round_money(coalesce(sum(
    soi.quantity - coalesce((
      select sum(wsi.quantity)
      from public.withdrawal_slip_items wsi
      join public.withdrawal_slips ws on ws.id = wsi.withdrawal_slip_id
      where wsi.sales_order_item_id = soi.id
        and ws.status = 'issued'
    ), 0)
  ), 0))
  from public.sales_order_items soi
  join public.sales_orders so on so.id = soi.sales_order_id
  where soi.item_id = p_item_id
    and so.status in ('open', 'closed');
$$;

-- Outstanding quantity on posted, in-transit, arrived, and partially received bills.
-- Physically received units, including damaged, are subtracted.
-- Accepted or resolved shortages are treated as settled and leave incoming.
-- Open, claim, rejected, and replacement-expected shortages stay incoming.
create or replace function public.inventory_incoming(p_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.round_money(coalesce(sum(outstanding), 0))
  from (
    select public.round_money(greatest(
      bli.shipped_qty
      - bli.received_qty
      - coalesce((
          select sum(d.quantity)
          from public.receiving_discrepancies d
          join public.receiving_report_items rri on rri.id = d.receiving_report_item_id
          join public.receiving_reports rr on rr.id = rri.receiving_report_id
          where rri.bol_item_id = bli.id
            and rr.status = 'posted'
            and d.discrepancy_type = 'short'
            and d.status in ('accepted', 'resolved')
        ), 0)
    , 0)) as outstanding
    from public.bill_of_lading_items bli
    join public.bills_of_lading bol on bol.id = bli.bill_of_lading_id
    where bli.item_id = p_item_id
      and bol.status in ('posted', 'in_transit', 'arrived', 'partially_received')
  ) lines;
$$;

-- Damaged quantity still outside sellable stock. Accepted or resolved damaged
-- lines have left quarantine. Cancelled receiving reports are excluded.
create or replace function public.inventory_quarantine(p_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.round_money(coalesce(sum(rri.damaged_qty), 0))
  from public.receiving_report_items rri
  join public.receiving_reports rr on rr.id = rri.receiving_report_id
  where rri.item_id = p_item_id
    and rr.status = 'posted'
    and rri.damaged_qty > 0
    and not exists (
      select 1
      from public.receiving_discrepancies d
      where d.receiving_report_item_id = rri.id
        and d.discrepancy_type = 'damaged'
        and d.status in ('accepted', 'resolved')
    );
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
  public.inventory_quarantine(i.id) as quarantine
from public.items i;

comment on view public.inventory_company_stock is
  'Company-wide on hand, incoming, committed, and available. Committed is not allocated to a warehouse.';

create table if not exists public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete restrict,
  warehouse_id uuid references public.warehouses (id) on delete restrict,
  identifier text not null,
  identifier_kind text not null check (identifier_kind in ('manufacturer_serial', 'internal_barcode')),
  state text not null default 'enrolled' check (state in ('enrolled', 'on_hand', 'quarantine', 'issued', 'returned')),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists inventory_units_identifier_key
  on public.inventory_units (lower(identifier));

create index if not exists inventory_units_item_idx on public.inventory_units (item_id);

alter table public.inventory_units enable row level security;

drop policy if exists inventory_units_select on public.inventory_units;
create policy inventory_units_select on public.inventory_units
  for select using (public.is_active_user());

grant select on public.inventory_units, public.inventory_company_stock to authenticated;
grant execute on function public.inventory_committed(uuid) to authenticated;
grant execute on function public.inventory_incoming(uuid) to authenticated;
grant execute on function public.inventory_quarantine(uuid) to authenticated;

create or replace function public.enroll_inventory_unit(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
  item_id uuid;
  wh uuid;
  ident text;
  kind text;
begin
  perform public.require_roles('admin', 'warehouse');
  item_id := nullif(payload->>'item_id', '')::uuid;
  ident := btrim(coalesce(payload->>'identifier', ''));
  kind := coalesce(nullif(payload->>'identifier_kind', ''), 'manufacturer_serial');
  if item_id is null or not exists (select 1 from public.items where id = item_id) then
    raise exception 'Item was not found';
  end if;
  if ident = '' then
    raise exception 'Serial or unit barcode is required';
  end if;
  if kind not in ('manufacturer_serial', 'internal_barcode') then
    raise exception 'Identifier kind is invalid';
  end if;
  if exists (select 1 from public.inventory_units where lower(identifier) = lower(ident)) then
    raise exception 'This serial or unit barcode is already enrolled';
  end if;
  wh := nullif(payload->>'warehouse_id', '')::uuid;
  if wh is not null and not exists (select 1 from public.warehouses where id = wh and status = 'active') then
    raise exception 'Warehouse not found or inactive';
  end if;
  insert into public.inventory_units (id, item_id, warehouse_id, identifier, identifier_kind, state, created_by)
  values (new_id, item_id, wh, ident, kind, 'enrolled', auth.uid());
  return new_id;
end;
$$;

grant execute on function public.enroll_inventory_unit(jsonb) to authenticated;

-- Opening a sales order commits quantity even when available is zero or short.
create or replace function public.open_sales_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  so public.sales_orders%rowtype;
begin
  perform public.require_roles('admin', 'sales');
  select * into so from public.sales_orders where id = p_id for update;
  if so.status is distinct from 'draft' then
    raise exception 'Only a draft sales order can be opened';
  end if;
  select count(*) into n from public.sales_order_items where sales_order_id = p_id;
  if n < 1 then
    raise exception 'At least one line is required';
  end if;

  perform 1 from public.items
  where id in (select item_id from public.sales_order_items where sales_order_id = p_id)
  for update;

  update public.sales_orders set status = 'open', updated_by = auth.uid() where id = p_id;
end;
$$;

-- Withdrawal slips keep one warehouse. Callers may choose it.
-- Omitted warehouse keeps the ATW warehouse so existing callers stay valid.
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
  elsif not exists (select 1 from public.warehouses where id = wh and status = 'active') then
    raise exception 'Warehouse not found or inactive';
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

create or replace view public.purchasing_variances as
select
  d.id,
  d.discrepancy_type,
  d.quantity,
  d.status,
  d.remarks,
  rri.item_id,
  rri.item_name,
  rri.shipped_qty,
  rri.actual_received_qty,
  rri.good_qty,
  rri.damaged_qty,
  rri.short_qty,
  rr.id as receiving_report_id,
  rr.rr_number,
  rr.status as receiving_status,
  rr.warehouse_id,
  bol.id as bill_of_lading_id,
  bol.bol_number,
  bol.status as bol_status
from public.receiving_discrepancies d
join public.receiving_report_items rri on rri.id = d.receiving_report_item_id
join public.receiving_reports rr on rr.id = rri.receiving_report_id
join public.bills_of_lading bol on bol.id = rr.bill_of_lading_id;

grant select on public.purchasing_variances to authenticated;
