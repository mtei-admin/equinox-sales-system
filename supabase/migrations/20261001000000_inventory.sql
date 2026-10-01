-- Inventory: warehouses, adjustment documents, movement ledger, reserved/available.
-- Do not edit earlier migrations. Physical stock moves when a withdrawal slip is issued.

create type public.inventory_adjustment_status as enum ('draft', 'posted', 'cancelled');
create type public.inventory_adjustment_direction as enum ('increase', 'decrease');
create type public.inventory_movement_source as enum ('adjustment', 'withdrawal_slip');

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status public.master_status not null default 'active',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger warehouses_set_updated_at
before update on public.warehouses
for each row execute function public.set_updated_at();

insert into public.warehouses (id, name, status)
values ('11111111-1111-4111-8111-111111111111', 'Main', 'active');

create or replace function public.default_warehouse_id()
returns uuid
language sql
stable
as $$
  select '11111111-1111-4111-8111-111111111111'::uuid;
$$;

alter table public.sales_orders
  add column warehouse_id uuid not null default public.default_warehouse_id()
  references public.warehouses (id) on delete restrict;

alter table public.invoices
  add column warehouse_id uuid not null default public.default_warehouse_id()
  references public.warehouses (id) on delete restrict;

alter table public.atw_documents
  add column warehouse_id uuid not null default public.default_warehouse_id()
  references public.warehouses (id) on delete restrict;

alter table public.withdrawal_slips
  add column warehouse_id uuid not null default public.default_warehouse_id()
  references public.warehouses (id) on delete restrict;

create index sales_orders_warehouse_idx on public.sales_orders (warehouse_id);
create index invoices_warehouse_idx on public.invoices (warehouse_id);
create index atw_documents_warehouse_idx on public.atw_documents (warehouse_id);
create index withdrawal_slips_warehouse_idx on public.withdrawal_slips (warehouse_id);

insert into public.document_sequences (doc_type) values ('inventory_adjustment');

create table public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  adj_number text not null unique,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  reason text,
  remarks text,
  status public.inventory_adjustment_status not null default 'draft',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  cancelled_by uuid references public.users (id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text
);

create trigger inventory_adjustments_set_updated_at
before update on public.inventory_adjustments
for each row execute function public.set_updated_at();

create table public.inventory_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.inventory_adjustments (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  item_name text not null,
  description text,
  model text,
  barcode text,
  quantity numeric(14, 2) not null check (quantity > 0),
  direction public.inventory_adjustment_direction not null,
  sort_order integer not null default 0
);

create index inventory_adjustment_items_header_idx on public.inventory_adjustment_items (adjustment_id);
create index inventory_adjustment_items_item_idx on public.inventory_adjustment_items (item_id);
create index inventory_adjustments_status_idx on public.inventory_adjustments (status);
create index inventory_adjustments_warehouse_idx on public.inventory_adjustments (warehouse_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  quantity numeric(14, 2) not null check (quantity <> 0),
  source_type public.inventory_movement_source not null,
  source_id uuid not null,
  source_line_id uuid,
  occurred_at timestamptz not null default now()
);

create index inventory_movements_item_idx on public.inventory_movements (warehouse_id, item_id);
create index inventory_movements_source_idx on public.inventory_movements (source_type, source_id);

create or replace function public.inventory_on_hand(p_warehouse_id uuid, p_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.round_money(coalesce(sum(m.quantity), 0))
  from public.inventory_movements m
  where m.warehouse_id = p_warehouse_id
    and m.item_id = p_item_id;
$$;

create or replace function public.inventory_reserved(p_warehouse_id uuid, p_item_id uuid)
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
    and so.warehouse_id = p_warehouse_id
    and so.status in ('open', 'closed');
$$;

create or replace function public.inventory_available(p_warehouse_id uuid, p_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.round_money(
    public.inventory_on_hand(p_warehouse_id, p_item_id)
    - public.inventory_reserved(p_warehouse_id, p_item_id)
  );
$$;

create or replace view public.inventory_stock as
select
  w.id as warehouse_id,
  w.name as warehouse_name,
  i.id as item_id,
  i.name as item_name,
  i.brand,
  i.model,
  i.barcode,
  i.status as item_status,
  public.inventory_on_hand(w.id, i.id) as on_hand,
  public.inventory_reserved(w.id, i.id) as reserved,
  public.inventory_available(w.id, i.id) as available
from public.warehouses w
cross join public.items i
where w.status = 'active';

-- ---------------------------------------------------------------------------
-- Copy warehouse_id down the document chain
-- ---------------------------------------------------------------------------

create or replace function public.create_sales_order(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  cust public.customers%rowtype;
  emp_name text;
  line jsonb;
  it public.items%rowtype;
  qty numeric;
  price numeric;
  amt numeric;
  i int := 0;
  sum_qty numeric := 0;
  sum_tot numeric := 0;
  wh uuid;
begin
  perform public.require_roles('admin', 'sales');

  select * into cust from public.customers where id = (payload->>'customer_id')::uuid;
  if cust.id is null or cust.status <> 'active' then
    raise exception 'Customer not found or inactive';
  end if;
  if coalesce(jsonb_array_length(payload->'lines'), 0) < 1 then
    raise exception 'At least one line is required';
  end if;

  wh := coalesce(nullif(payload->>'warehouse_id', '')::uuid, public.default_warehouse_id());
  if not exists (select 1 from public.warehouses where id = wh and status = 'active') then
    raise exception 'Warehouse not found or inactive';
  end if;

  select full_name into emp_name from public.users
  where id = nullif(payload->>'sales_employee_id', '')::uuid and status = 'active';

  insert into public.sales_orders (
    so_number, warehouse_id, customer_id, customer_name, delivery_address, order_date, term, reference_no, order_type,
    sales_employee_id, sales_employee_name, remarks, created_by, updated_by
  ) values (
    public.next_doc_number('sales_order', 'SO-'),
    wh,
    cust.id,
    cust.name,
    coalesce(payload->>'delivery_address', cust.billing_address),
    coalesce((payload->>'order_date')::date, (timezone('Asia/Manila', now()))::date),
    payload->>'term',
    payload->>'reference_no',
    payload->>'order_type',
    nullif(payload->>'sales_employee_id', '')::uuid,
    emp_name,
    payload->>'remarks',
    auth.uid(),
    auth.uid()
  ) returning id into new_id;

  for line in select * from jsonb_array_elements(payload->'lines')
  loop
    i := i + 1;
    select * into it from public.items where id = (line->>'item_id')::uuid;
    if it.id is null or it.status <> 'active' then
      raise exception 'Item not found or inactive';
    end if;
    qty := (line->>'quantity')::numeric;
    price := coalesce((line->>'unit_price')::numeric, 0);
    if qty is null or qty <= 0 then
      raise exception 'Quantity must be greater than 0';
    end if;
    amt := public.round_money(qty * price);
    sum_qty := sum_qty + qty;
    sum_tot := sum_tot + amt;
    insert into public.sales_order_items (
      sales_order_id, item_id, model, serial_no, barcode, description,
      quantity, uom, unit_price, amount, total_amount, sort_order
    ) values (
      new_id, it.id,
      coalesce(line->>'model', it.model),
      coalesce(line->>'serial_no', it.serial_no),
      coalesce(line->>'barcode', it.barcode),
      coalesce(line->>'description', it.description),
      qty, coalesce(line->>'uom', 'PCS'), public.round_money(price), amt, amt, i
    );
  end loop;

  update public.sales_orders
  set total_quantity = public.round_money(sum_qty), grand_total = public.round_money(sum_tot)
  where id = new_id;
  return new_id;
end;
$$;

create or replace function public.open_sales_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  st public.so_status;
  so public.sales_orders%rowtype;
  rec record;
  avail numeric;
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

  for rec in
    select soi.item_id, public.round_money(sum(soi.quantity)) as qty
    from public.sales_order_items soi
    where soi.sales_order_id = p_id
    group by soi.item_id
  loop
    avail := public.inventory_available(so.warehouse_id, rec.item_id);
    if rec.qty > avail then
      raise exception 'Available quantity % is less than required %', avail, rec.qty;
    end if;
  end loop;

  update public.sales_orders set status = 'open', updated_by = auth.uid() where id = p_id;
end;
$$;

create or replace function public.create_invoice(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  so public.sales_orders%rowtype;
  line jsonb;
  soi public.sales_order_items%rowtype;
  qty numeric;
  tax numeric;
  amt numeric;
  tot numeric;
  i int := 0;
  sum_qty numeric := 0;
  sum_tot numeric := 0;
  remaining numeric;
  leftover numeric;
begin
  perform public.require_roles('admin', 'sales');

  select * into so from public.sales_orders where id = (payload->>'sales_order_id')::uuid for update;
  if so.id is null then
    raise exception 'Sales order not found';
  end if;
  if so.status is distinct from 'open' then
    raise exception 'Sales order must be open to invoice';
  end if;
  if coalesce(jsonb_array_length(payload->'lines'), 0) < 1 then
    raise exception 'At least one line is required';
  end if;
  if nullif(trim(payload->>'invoice_number'), '') is null then
    raise exception 'Invoice number is required';
  end if;

  perform 1 from public.sales_order_items where sales_order_id = so.id for update;

  select public.round_money(coalesce(sum(line_row.quantity - public.so_item_invoiced_qty(line_row.id)), 0))
  into leftover
  from public.sales_order_items as line_row
  where line_row.sales_order_id = so.id;
  if leftover <= 0 then
    raise exception 'Sales order is already fully invoiced';
  end if;

  insert into public.invoices (
    invoice_number, warehouse_id, sales_order_id, customer_id, customer_name, delivery_address, order_date,
    term, reference_no, order_type, sales_employee_id, sales_employee_name, remarks, created_by, updated_by
  ) values (
    trim(payload->>'invoice_number'),
    so.warehouse_id,
    so.id, so.customer_id, so.customer_name, so.delivery_address, so.order_date,
    so.term, so.reference_no, so.order_type, so.sales_employee_id, so.sales_employee_name,
    payload->>'remarks', auth.uid(), auth.uid()
  ) returning id into new_id;

  for line in select * from jsonb_array_elements(payload->'lines')
  loop
    i := i + 1;
    select * into soi from public.sales_order_items where id = (line->>'sales_order_item_id')::uuid;
    if soi.id is null or soi.sales_order_id <> so.id then
      raise exception 'Invoice line does not belong to the sales order';
    end if;
    qty := (line->>'quantity')::numeric;
    tax := coalesce((line->>'tax_amount')::numeric, 0);
    if qty is null or qty <= 0 then
      raise exception 'Quantity must be greater than 0';
    end if;
    remaining := public.round_money(soi.quantity - public.so_item_invoiced_qty(soi.id));
    if qty > remaining then
      raise exception 'Invoice quantity % exceeds remaining %', qty, remaining;
    end if;
    amt := public.round_money(qty * soi.unit_price);
    tot := public.round_money(amt + tax);
    sum_qty := sum_qty + qty;
    sum_tot := sum_tot + tot;
    insert into public.invoice_items (
      invoice_id, sales_order_item_id, item_id, model, serial_no, barcode, description,
      quantity, uom, unit_price, tax_amount, amount, total_amount, sort_order
    ) values (
      new_id, soi.id, soi.item_id, soi.model, soi.serial_no, soi.barcode, soi.description,
      qty, soi.uom, soi.unit_price, public.round_money(tax), amt, tot, i
    );
  end loop;

  update public.invoices
  set total_quantity = public.round_money(sum_qty), grand_total = public.round_money(sum_tot)
  where id = new_id;
  return new_id;
exception
  when unique_violation then
    raise exception 'Invoice number already in use';
end;
$$;

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
    inv.warehouse_id,
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

  insert into public.withdrawal_slips (
    ws_number, warehouse_id, atw_id, invoice_id, sales_order_id, customer_id, customer_name, delivery_address,
    order_date, term, reference_no, order_type, sales_employee_id, sales_employee_name, remarks, created_by, updated_by
  ) values (
    public.next_doc_number('withdrawal_slip', 'WS-'),
    atw.warehouse_id,
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

create or replace function public.issue_withdrawal_slip(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ws public.withdrawal_slips%rowtype;
  rec record;
  on_hand numeric;
  signed_qty numeric;
begin
  perform public.require_roles('admin', 'warehouse');
  select * into ws from public.withdrawal_slips where id = p_id for update;
  if ws.status is distinct from 'draft' then
    raise exception 'Only a draft withdrawal slip can be issued';
  end if;

  perform 1 from public.items
  where id in (select item_id from public.withdrawal_slip_items where withdrawal_slip_id = p_id)
  for update;

  for rec in
    select wsi.item_id, public.round_money(sum(wsi.quantity)) as qty
    from public.withdrawal_slip_items wsi
    where wsi.withdrawal_slip_id = p_id
    group by wsi.item_id
  loop
    on_hand := public.inventory_on_hand(ws.warehouse_id, rec.item_id);
    if rec.qty > on_hand then
      raise exception 'On-hand quantity % is less than withdrawal %', on_hand, rec.qty;
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

create or replace function public.cancel_withdrawal_slip(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ws public.withdrawal_slips%rowtype;
  rec record;
begin
  perform public.require_roles('admin', 'warehouse');
  select * into ws from public.withdrawal_slips where id = p_id for update;
  if ws.id is null or ws.status = 'cancelled' then
    raise exception 'Withdrawal slip cannot be cancelled';
  end if;

  if ws.status = 'issued' then
    perform 1 from public.items
    where id in (select item_id from public.withdrawal_slip_items where withdrawal_slip_id = p_id)
    for update;

    for rec in
      select id, item_id, quantity
      from public.withdrawal_slip_items
      where withdrawal_slip_id = p_id
    loop
      insert into public.inventory_movements (
        warehouse_id, item_id, quantity, source_type, source_id, source_line_id
      ) values (
        ws.warehouse_id, rec.item_id, public.round_money(rec.quantity), 'withdrawal_slip', p_id, rec.id
      );
    end loop;
  end if;

  update public.withdrawal_slips
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
      cancellation_reason = p_reason, updated_by = auth.uid()
  where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Adjustment RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_inventory_adjustment(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  wh uuid;
  line jsonb;
  it public.items%rowtype;
  qty numeric;
  dir public.inventory_adjustment_direction;
  i int := 0;
begin
  perform public.require_roles('admin', 'warehouse');

  if coalesce(jsonb_array_length(payload->'lines'), 0) < 1 then
    raise exception 'At least one line is required';
  end if;
  wh := coalesce(nullif(payload->>'warehouse_id', '')::uuid, public.default_warehouse_id());
  if not exists (select 1 from public.warehouses where id = wh and status = 'active') then
    raise exception 'Warehouse not found or inactive';
  end if;

  insert into public.inventory_adjustments (
    adj_number, warehouse_id, remarks, created_by, updated_by
  ) values (
    public.next_doc_number('inventory_adjustment', 'ADJ-'),
    wh,
    payload->>'remarks',
    auth.uid(),
    auth.uid()
  ) returning id into new_id;

  for line in select * from jsonb_array_elements(payload->'lines')
  loop
    i := i + 1;
    select * into it from public.items where id = (line->>'item_id')::uuid;
    if it.id is null or it.status <> 'active' then
      raise exception 'Item not found or inactive';
    end if;
    qty := (line->>'quantity')::numeric;
    if qty is null or qty <= 0 then
      raise exception 'Quantity must be greater than 0';
    end if;
    dir := (line->>'direction')::public.inventory_adjustment_direction;
    if dir is null then
      raise exception 'Adjustment direction is required';
    end if;
    insert into public.inventory_adjustment_items (
      adjustment_id, item_id, item_name, description, model, barcode, quantity, direction, sort_order
    ) values (
      new_id, it.id, it.name, it.description, it.model, it.barcode, public.round_money(qty), dir, i
    );
  end loop;
  return new_id;
end;
$$;

create or replace function public.update_inventory_adjustment(p_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.inventory_adjustment_status;
  line jsonb;
  it public.items%rowtype;
  qty numeric;
  dir public.inventory_adjustment_direction;
  i int := 0;
begin
  perform public.require_roles('admin', 'warehouse');
  select status into st from public.inventory_adjustments where id = p_id for update;
  if st is null then
    raise exception 'Adjustment not found';
  end if;
  if st is distinct from 'draft' then
    raise exception 'Only a draft adjustment can be edited';
  end if;
  if coalesce(jsonb_array_length(payload->'lines'), 0) < 1 then
    raise exception 'At least one line is required';
  end if;

  update public.inventory_adjustments
  set remarks = payload->>'remarks', updated_by = auth.uid()
  where id = p_id;

  delete from public.inventory_adjustment_items where adjustment_id = p_id;

  for line in select * from jsonb_array_elements(payload->'lines')
  loop
    i := i + 1;
    select * into it from public.items where id = (line->>'item_id')::uuid;
    if it.id is null or it.status <> 'active' then
      raise exception 'Item not found or inactive';
    end if;
    qty := (line->>'quantity')::numeric;
    if qty is null or qty <= 0 then
      raise exception 'Quantity must be greater than 0';
    end if;
    dir := (line->>'direction')::public.inventory_adjustment_direction;
    if dir is null then
      raise exception 'Adjustment direction is required';
    end if;
    insert into public.inventory_adjustment_items (
      adjustment_id, item_id, item_name, description, model, barcode, quantity, direction, sort_order
    ) values (
      p_id, it.id, it.name, it.description, it.model, it.barcode, public.round_money(qty), dir, i
    );
  end loop;
  return p_id;
end;
$$;

create or replace function public.post_inventory_adjustment(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  adj public.inventory_adjustments%rowtype;
  rec record;
  signed_qty numeric;
  avail numeric;
begin
  perform public.require_roles('admin', 'warehouse');
  if nullif(trim(p_reason), '') is null then
    raise exception 'Posting reason is required';
  end if;
  select * into adj from public.inventory_adjustments where id = p_id for update;
  if adj.status is distinct from 'draft' then
    raise exception 'Only a draft adjustment can be posted';
  end if;
  if not exists (select 1 from public.inventory_adjustment_items where adjustment_id = p_id) then
    raise exception 'At least one line is required';
  end if;

  perform 1 from public.items
  where id in (select item_id from public.inventory_adjustment_items where adjustment_id = p_id)
  for update;

  for rec in
    select item_id, public.round_money(sum(quantity)) as qty
    from public.inventory_adjustment_items
    where adjustment_id = p_id and direction = 'decrease'
    group by item_id
  loop
    avail := public.inventory_available(adj.warehouse_id, rec.item_id);
    if rec.qty > avail then
      raise exception 'Available quantity % is less than required %', avail, rec.qty;
    end if;
  end loop;

  for rec in
    select id, item_id, quantity, direction
    from public.inventory_adjustment_items
    where adjustment_id = p_id
  loop
    signed_qty := case when rec.direction = 'increase' then rec.quantity else public.round_money(rec.quantity * -1) end;
    insert into public.inventory_movements (
      warehouse_id, item_id, quantity, source_type, source_id, source_line_id
    ) values (
      adj.warehouse_id, rec.item_id, signed_qty, 'adjustment', p_id, rec.id
    );
  end loop;

  update public.inventory_adjustments
  set status = 'posted', reason = trim(p_reason), updated_by = auth.uid()
  where id = p_id;
end;
$$;

create or replace function public.cancel_inventory_adjustment(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  adj public.inventory_adjustments%rowtype;
  rec record;
  signed_qty numeric;
  avail numeric;
begin
  perform public.require_roles('admin', 'warehouse');
  if nullif(trim(p_reason), '') is null then
    raise exception 'Cancellation reason is required';
  end if;
  select * into adj from public.inventory_adjustments where id = p_id for update;
  if adj.id is null or adj.status = 'cancelled' then
    raise exception 'Adjustment cannot be cancelled';
  end if;

  if adj.status = 'posted' then
    perform 1 from public.items
    where id in (select item_id from public.inventory_adjustment_items where adjustment_id = p_id)
    for update;

    for rec in
      select item_id, public.round_money(sum(quantity)) as qty
      from public.inventory_adjustment_items
      where adjustment_id = p_id and direction = 'increase'
      group by item_id
    loop
      avail := public.inventory_available(adj.warehouse_id, rec.item_id);
      if rec.qty > avail then
        raise exception 'Available quantity % is less than required %', avail, rec.qty;
      end if;
    end loop;

    for rec in
      select id, item_id, quantity, direction
      from public.inventory_adjustment_items
      where adjustment_id = p_id
    loop
      signed_qty := case when rec.direction = 'increase' then public.round_money(rec.quantity * -1) else rec.quantity end;
      insert into public.inventory_movements (
        warehouse_id, item_id, quantity, source_type, source_id, source_line_id
      ) values (
        adj.warehouse_id, rec.item_id, signed_qty, 'adjustment', p_id, rec.id
      );
    end loop;
  end if;

  update public.inventory_adjustments
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
      cancellation_reason = trim(p_reason), updated_by = auth.uid()
  where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.warehouses enable row level security;
alter table public.inventory_adjustments enable row level security;
alter table public.inventory_adjustment_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy warehouses_select on public.warehouses for select using (public.is_active_user());
create policy warehouses_admin_write on public.warehouses
for all using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy inventory_adjustments_select on public.inventory_adjustments for select using (public.is_active_user());
create policy inventory_adjustment_items_select on public.inventory_adjustment_items for select using (public.is_active_user());
create policy inventory_movements_select on public.inventory_movements for select using (public.is_active_user());

grant select on public.warehouses, public.inventory_adjustments, public.inventory_adjustment_items,
  public.inventory_movements, public.inventory_stock
  to authenticated;
grant insert, update, delete on public.warehouses to authenticated;

grant execute on function public.default_warehouse_id() to authenticated;
grant execute on function public.inventory_on_hand(uuid, uuid) to authenticated;
grant execute on function public.inventory_reserved(uuid, uuid) to authenticated;
grant execute on function public.inventory_available(uuid, uuid) to authenticated;
grant execute on function public.create_inventory_adjustment(jsonb) to authenticated;
grant execute on function public.update_inventory_adjustment(uuid, jsonb) to authenticated;
grant execute on function public.post_inventory_adjustment(uuid, text) to authenticated;
grant execute on function public.cancel_inventory_adjustment(uuid, text) to authenticated;

comment on table public.warehouses is 'Physical locations. v1 seeds one Main warehouse.';
comment on table public.inventory_movements is 'Append-only signed quantity ledger. On-hand is the sum of movements.';
comment on table public.inventory_adjustments is 'Transactional stock increase/decrease. Posted rows write movements; cancel writes reversing movements.';
comment on function public.inventory_available(uuid, uuid) is 'On-hand minus reserved (open/closed SO qty not yet issued on a withdrawal slip).';
