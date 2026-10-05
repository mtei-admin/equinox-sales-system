-- Purchasing: supplier → purchase order → bill of lading → receiving report.
-- PO and BOL do not move stock. A posted receiving report adds good quantity
-- to inventory_movements. Cancelled numbers are not reused.

create type public.po_status as enum (
  'draft',
  'for_approval',
  'approved',
  'partially_shipped',
  'fully_shipped',
  'partially_received',
  'completed',
  'closed',
  'cancelled'
);

create type public.bol_status as enum (
  'draft',
  'posted',
  'in_transit',
  'arrived',
  'partially_received',
  'fully_received',
  'cancelled'
);

create type public.rr_status as enum ('draft', 'posted', 'cancelled');

create type public.shipment_mode as enum ('sea', 'land');

create type public.discrepancy_type as enum ('short', 'damaged', 'excess');

create type public.discrepancy_status as enum (
  'open',
  'accepted',
  'for_claim',
  'replacement_expected',
  'rejected',
  'resolved'
);

insert into public.document_sequences (doc_type) values
  ('supplier'),
  ('purchase_order'),
  ('bill_of_lading'),
  ('receiving_report');

alter table public.inventory_movements
  add column reverses_movement_id uuid references public.inventory_movements (id) on delete restrict;

create index inventory_movements_reversal_idx on public.inventory_movements (reverses_movement_id);

-- ---------------------------------------------------------------------------
-- Supplier
-- ---------------------------------------------------------------------------

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_code text not null unique,
  name text not null,
  address text,
  contact_person text,
  contact_number text,
  email text,
  tin_number text,
  payment_terms text,
  remarks text,
  status public.master_status not null default 'active',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create index suppliers_status_idx on public.suppliers (status);
create index suppliers_name_idx on public.suppliers (name);

create or replace function public.suppliers_assign_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.supplier_code is null or btrim(new.supplier_code) = '' then
    new.supplier_code := public.next_doc_number('supplier', 'SUP-');
  end if;
  return new;
end;
$$;

create trigger suppliers_assign_code
before insert on public.suppliers
for each row execute function public.suppliers_assign_code();

-- ---------------------------------------------------------------------------
-- Purchase order
-- ---------------------------------------------------------------------------

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  supplier_code text not null,
  supplier_name text not null,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  po_date date not null,
  expected_delivery_date date,
  destination text,
  payment_terms text,
  supplier_reference text,
  remarks text,
  status public.po_status not null default 'draft',
  total_quantity numeric(14, 2) not null default 0,
  grand_total numeric(14, 2) not null default 0,
  approved_by uuid references public.users (id) on delete set null,
  approved_at timestamptz,
  closed_by uuid references public.users (id) on delete set null,
  closed_at timestamptz,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  cancelled_by uuid references public.users (id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text
);

create trigger purchase_orders_set_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index purchase_orders_status_idx on public.purchase_orders (status);
create index purchase_orders_date_idx on public.purchase_orders (po_date);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  item_name text not null,
  model text,
  barcode text,
  uom text not null,
  ordered_qty numeric(14, 2) not null check (ordered_qty > 0),
  unit_cost numeric(14, 2) not null check (unit_cost >= 0),
  amount numeric(14, 2) not null check (amount >= 0),
  shipped_qty numeric(14, 2) not null default 0 check (shipped_qty >= 0),
  received_qty numeric(14, 2) not null default 0 check (received_qty >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger purchase_order_items_set_updated_at
before update on public.purchase_order_items
for each row execute function public.set_updated_at();

create index purchase_order_items_header_idx on public.purchase_order_items (purchase_order_id);
create index purchase_order_items_item_idx on public.purchase_order_items (item_id);

-- ---------------------------------------------------------------------------
-- Bill of lading
-- ---------------------------------------------------------------------------

create table public.bills_of_lading (
  id uuid primary key default gen_random_uuid(),
  bol_number text not null unique,
  purchase_order_id uuid not null references public.purchase_orders (id) on delete restrict,
  shipment_mode public.shipment_mode not null default 'land',
  shipment_date date not null,
  expected_arrival_date date,
  carrier text,
  vessel_name text,
  voyage_number text,
  container_number text,
  seal_number text,
  vehicle_plate_number text,
  origin text,
  destination text,
  reference_number text,
  remarks text,
  status public.bol_status not null default 'draft',
  posted_by uuid references public.users (id) on delete set null,
  posted_at timestamptz,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  cancelled_by uuid references public.users (id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text
);

create trigger bills_of_lading_set_updated_at
before update on public.bills_of_lading
for each row execute function public.set_updated_at();

create index bills_of_lading_po_idx on public.bills_of_lading (purchase_order_id);
create index bills_of_lading_status_idx on public.bills_of_lading (status);
create index bills_of_lading_shipment_date_idx on public.bills_of_lading (shipment_date);

create table public.bill_of_lading_items (
  id uuid primary key default gen_random_uuid(),
  bill_of_lading_id uuid not null references public.bills_of_lading (id) on delete restrict,
  purchase_order_item_id uuid not null references public.purchase_order_items (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  item_name text not null,
  model text,
  barcode text,
  uom text not null,
  shipped_qty numeric(14, 2) not null check (shipped_qty > 0),
  received_qty numeric(14, 2) not null default 0 check (received_qty >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bill_of_lading_id, purchase_order_item_id)
);

create trigger bill_of_lading_items_set_updated_at
before update on public.bill_of_lading_items
for each row execute function public.set_updated_at();

create index bill_of_lading_items_header_idx on public.bill_of_lading_items (bill_of_lading_id);
create index bill_of_lading_items_po_item_idx on public.bill_of_lading_items (purchase_order_item_id);

-- ---------------------------------------------------------------------------
-- Receiving report
-- ---------------------------------------------------------------------------

create table public.receiving_reports (
  id uuid primary key default gen_random_uuid(),
  rr_number text not null unique,
  bill_of_lading_id uuid not null references public.bills_of_lading (id) on delete restrict,
  purchase_order_id uuid not null references public.purchase_orders (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  receiving_date date not null,
  delivery_receipt_number text,
  supplier_invoice_number text,
  received_by uuid references public.users (id) on delete set null,
  received_by_name text,
  checked_by uuid references public.users (id) on delete set null,
  checked_by_name text,
  remarks text,
  gross_weight numeric(14, 2) check (gross_weight is null or gross_weight >= 0),
  tare_weight numeric(14, 2) check (tare_weight is null or tare_weight >= 0),
  net_weight numeric(14, 2) check (net_weight is null or net_weight >= 0),
  weighbridge_ticket text,
  status public.rr_status not null default 'draft',
  posted_by uuid references public.users (id) on delete set null,
  posted_at timestamptz,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  cancelled_by uuid references public.users (id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text
);

create trigger receiving_reports_set_updated_at
before update on public.receiving_reports
for each row execute function public.set_updated_at();

create index receiving_reports_bol_idx on public.receiving_reports (bill_of_lading_id);
create index receiving_reports_po_idx on public.receiving_reports (purchase_order_id);
create index receiving_reports_status_idx on public.receiving_reports (status);
create index receiving_reports_date_idx on public.receiving_reports (receiving_date);

create table public.receiving_report_items (
  id uuid primary key default gen_random_uuid(),
  receiving_report_id uuid not null references public.receiving_reports (id) on delete restrict,
  bol_item_id uuid not null references public.bill_of_lading_items (id) on delete restrict,
  purchase_order_item_id uuid not null references public.purchase_order_items (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  item_name text not null,
  uom text not null,
  shipped_qty numeric(14, 2) not null check (shipped_qty > 0),
  previously_received_qty numeric(14, 2) not null check (previously_received_qty >= 0),
  actual_received_qty numeric(14, 2) not null check (actual_received_qty >= 0),
  good_qty numeric(14, 2) not null check (good_qty >= 0),
  damaged_qty numeric(14, 2) not null check (damaged_qty >= 0),
  short_qty numeric(14, 2) not null check (short_qty >= 0),
  excess_qty numeric(14, 2) not null check (excess_qty >= 0),
  record_short boolean not null default false,
  accept_excess boolean not null default false,
  remarks text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (receiving_report_id, bol_item_id),
  check (actual_received_qty = good_qty + damaged_qty)
);

create trigger receiving_report_items_set_updated_at
before update on public.receiving_report_items
for each row execute function public.set_updated_at();

create index receiving_report_items_header_idx on public.receiving_report_items (receiving_report_id);
create index receiving_report_items_bol_item_idx on public.receiving_report_items (bol_item_id);

create table public.receiving_discrepancies (
  id uuid primary key default gen_random_uuid(),
  receiving_report_item_id uuid not null references public.receiving_report_items (id) on delete restrict,
  discrepancy_type public.discrepancy_type not null,
  quantity numeric(14, 2) not null check (quantity > 0),
  status public.discrepancy_status not null default 'open',
  remarks text,
  resolution_remarks text,
  resolved_by uuid references public.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger receiving_discrepancies_set_updated_at
before update on public.receiving_discrepancies
for each row execute function public.set_updated_at();

create index receiving_discrepancies_item_idx on public.receiving_discrepancies (receiving_report_item_id);
create index receiving_discrepancies_status_idx on public.receiving_discrepancies (status);

create table public.purchasing_events (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  document_id uuid not null,
  reference_number text,
  action text not null,
  old_status text,
  new_status text,
  remarks text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index purchasing_events_document_idx on public.purchasing_events (document_type, document_id, created_at);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.record_purchasing_event(
  p_type text,
  p_id uuid,
  p_number text,
  p_action text,
  p_old text,
  p_new text,
  p_remarks text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.purchasing_events (
    document_type, document_id, reference_number, action, old_status, new_status, remarks, created_by
  ) values (
    p_type, p_id, p_number, p_action, p_old, p_new, nullif(btrim(coalesce(p_remarks, '')), ''), auth.uid()
  );
end;
$$;

create or replace function public.refresh_bol_status(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.bol_status;
  shipped numeric;
  received numeric;
  next_status public.bol_status;
begin
  select status into st from public.bills_of_lading where id = p_id for update;
  if st is null or st in ('draft', 'cancelled') then
    return;
  end if;
  select
    public.round_money(coalesce(sum(shipped_qty), 0)),
    public.round_money(coalesce(sum(received_qty), 0))
  into shipped, received
  from public.bill_of_lading_items
  where bill_of_lading_id = p_id;

  if shipped > 0 and received >= shipped then
    next_status := 'fully_received';
  elsif received > 0 then
    next_status := 'partially_received';
  elsif st in ('in_transit', 'arrived') then
    next_status := st;
  else
    next_status := 'posted';
  end if;

  if next_status is distinct from st then
    update public.bills_of_lading
    set status = next_status, updated_by = auth.uid()
    where id = p_id;
  end if;
end;
$$;

create or replace function public.refresh_purchase_order_status(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.po_status;
  next_status public.po_status;
  incomplete_ship boolean;
  uncovered boolean;
  open_disc boolean;
  any_received boolean;
  any_shipped boolean;
begin
  select status into st from public.purchase_orders where id = p_id for update;
  if st is null or st in ('draft', 'for_approval', 'cancelled', 'closed') then
    return;
  end if;

  select exists (
    select 1 from public.purchase_order_items poi
    where poi.purchase_order_id = p_id
      and poi.shipped_qty < poi.ordered_qty
  ) into incomplete_ship;

  select exists (
    select 1
    from public.purchase_order_items poi
    where poi.purchase_order_id = p_id
      and poi.received_qty + coalesce((
        select sum(d.quantity)
        from public.receiving_discrepancies d
        join public.receiving_report_items ri on ri.id = d.receiving_report_item_id
        join public.receiving_reports rr on rr.id = ri.receiving_report_id
        where ri.purchase_order_item_id = poi.id
          and rr.status = 'posted'
          and d.discrepancy_type = 'short'
          and d.status in ('accepted', 'resolved')
      ), 0) < poi.ordered_qty
  ) into uncovered;

  select exists (
    select 1
    from public.receiving_discrepancies d
    join public.receiving_report_items ri on ri.id = d.receiving_report_item_id
    join public.receiving_reports rr on rr.id = ri.receiving_report_id
    where rr.purchase_order_id = p_id
      and rr.status <> 'cancelled'
      and d.status = 'open'
  ) into open_disc;

  select exists (
    select 1 from public.purchase_order_items where purchase_order_id = p_id and received_qty > 0
  ) into any_received;

  select exists (
    select 1 from public.purchase_order_items where purchase_order_id = p_id and shipped_qty > 0
  ) into any_shipped;

  if not incomplete_ship and not uncovered and not open_disc then
    next_status := 'completed';
  elsif any_received or open_disc then
    next_status := 'partially_received';
  elsif not incomplete_ship and any_shipped then
    next_status := 'fully_shipped';
  elsif any_shipped then
    next_status := 'partially_shipped';
  else
    next_status := 'approved';
  end if;

  if next_status is distinct from st then
    update public.purchase_orders
    set status = next_status, updated_by = auth.uid()
    where id = p_id;
    perform public.record_purchasing_event(
      'purchase_order', p_id,
      (select po_number from public.purchase_orders where id = p_id),
      'status_changed', st::text, next_status::text, null
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Purchase order RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_purchase_order(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sup public.suppliers%rowtype;
  new_id uuid := gen_random_uuid();
  line jsonb;
  it public.items%rowtype;
  qty numeric;
  cost numeric;
  amt numeric;
  i integer := 0;
  sum_qty numeric := 0;
  sum_amt numeric := 0;
  po_no text;
  wh uuid;
begin
  perform public.require_roles('admin');
  if payload is null or jsonb_typeof(payload->'lines') <> 'array' or jsonb_array_length(payload->'lines') = 0 then
    raise exception 'Purchase order needs at least one item';
  end if;
  select * into sup from public.suppliers where id = (payload->>'supplier_id')::uuid;
  if sup.id is null or sup.status <> 'active' then
    raise exception 'Supplier must be active';
  end if;
  wh := coalesce(nullif(payload->>'warehouse_id', '')::uuid, public.default_warehouse_id());
  po_no := public.next_doc_number('purchase_order', 'PO-');
  insert into public.purchase_orders (
    id, po_number, supplier_id, supplier_code, supplier_name, warehouse_id,
    po_date, expected_delivery_date, destination, payment_terms, supplier_reference, remarks,
    status, created_by, updated_by
  ) values (
    new_id, po_no, sup.id, sup.supplier_code, sup.name, wh,
    coalesce((payload->>'po_date')::date, (now() at time zone 'Asia/Manila')::date),
    nullif(payload->>'expected_delivery_date', '')::date,
    nullif(btrim(coalesce(payload->>'destination', '')), ''),
    nullif(btrim(coalesce(payload->>'payment_terms', '')), ''),
    nullif(btrim(coalesce(payload->>'supplier_reference', '')), ''),
    nullif(btrim(coalesce(payload->>'remarks', '')), ''),
    'draft', auth.uid(), auth.uid()
  );
  for line in select value from jsonb_array_elements(payload->'lines')
  loop
    i := i + 1;
    qty := public.round_money((line->>'ordered_qty')::numeric);
    cost := public.round_money(coalesce((line->>'unit_cost')::numeric, 0));
    if qty <= 0 then
      raise exception 'Quantity must be greater than 0';
    end if;
    if cost < 0 then
      raise exception 'Unit cost cannot be negative';
    end if;
    select * into it from public.items where id = (line->>'item_id')::uuid;
    if it.id is null or it.status <> 'active' then
      raise exception 'Item must be active';
    end if;
    amt := public.round_money(qty * cost);
    insert into public.purchase_order_items (
      purchase_order_id, item_id, item_name, model, barcode, uom,
      ordered_qty, unit_cost, amount, sort_order
    ) values (
      new_id, it.id, it.name, it.model, it.barcode,
      coalesce(nullif(btrim(coalesce(line->>'uom', '')), ''), 'PCS'),
      qty, cost, amt, i
    );
    sum_qty := sum_qty + qty;
    sum_amt := sum_amt + amt;
  end loop;
  update public.purchase_orders
  set total_quantity = public.round_money(sum_qty), grand_total = public.round_money(sum_amt)
  where id = new_id;
  perform public.record_purchasing_event('purchase_order', new_id, po_no, 'created', null, 'draft', null);
  return new_id;
end;
$$;

create or replace function public.update_purchase_order(p_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  po public.purchase_orders%rowtype;
  sup public.suppliers%rowtype;
  line jsonb;
  it public.items%rowtype;
  qty numeric;
  cost numeric;
  amt numeric;
  i integer := 0;
  sum_qty numeric := 0;
  sum_amt numeric := 0;
begin
  perform public.require_roles('admin');
  select * into po from public.purchase_orders where id = p_id for update;
  if po.id is null or po.status <> 'draft' then
    raise exception 'Only a draft purchase order can be edited';
  end if;
  if exists (
    select 1 from public.bills_of_lading b
    where b.purchase_order_id = p_id and b.status <> 'cancelled'
  ) then
    raise exception 'Cancellation cannot continue because subsequent transactions exist';
  end if;
  select * into sup from public.suppliers where id = (payload->>'supplier_id')::uuid;
  if sup.id is null or sup.status <> 'active' then
    raise exception 'Supplier must be active';
  end if;
  delete from public.purchase_order_items where purchase_order_id = p_id;
  for line in select value from jsonb_array_elements(payload->'lines')
  loop
    i := i + 1;
    qty := public.round_money((line->>'ordered_qty')::numeric);
    cost := public.round_money(coalesce((line->>'unit_cost')::numeric, 0));
    if qty <= 0 then
      raise exception 'Quantity must be greater than 0';
    end if;
    select * into it from public.items where id = (line->>'item_id')::uuid;
    if it.id is null or it.status <> 'active' then
      raise exception 'Item must be active';
    end if;
    amt := public.round_money(qty * cost);
    insert into public.purchase_order_items (
      purchase_order_id, item_id, item_name, model, barcode, uom,
      ordered_qty, unit_cost, amount, sort_order
    ) values (
      p_id, it.id, it.name, it.model, it.barcode,
      coalesce(nullif(btrim(coalesce(line->>'uom', '')), ''), 'PCS'),
      qty, cost, amt, i
    );
    sum_qty := sum_qty + qty;
    sum_amt := sum_amt + amt;
  end loop;
  update public.purchase_orders
  set supplier_id = sup.id,
      supplier_code = sup.supplier_code,
      supplier_name = sup.name,
      po_date = coalesce((payload->>'po_date')::date, po_date),
      expected_delivery_date = nullif(payload->>'expected_delivery_date', '')::date,
      destination = nullif(btrim(coalesce(payload->>'destination', '')), ''),
      payment_terms = nullif(btrim(coalesce(payload->>'payment_terms', '')), ''),
      supplier_reference = nullif(btrim(coalesce(payload->>'supplier_reference', '')), ''),
      remarks = nullif(btrim(coalesce(payload->>'remarks', '')), ''),
      total_quantity = public.round_money(sum_qty),
      grand_total = public.round_money(sum_amt),
      updated_by = auth.uid()
  where id = p_id;
  return p_id;
end;
$$;

create or replace function public.submit_purchase_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  po public.purchase_orders%rowtype;
begin
  perform public.require_roles('admin');
  select * into po from public.purchase_orders where id = p_id for update;
  if po.status is distinct from 'draft' then
    raise exception 'Only a draft purchase order can be submitted';
  end if;
  update public.purchase_orders
  set status = 'for_approval', updated_by = auth.uid()
  where id = p_id;
  perform public.record_purchasing_event('purchase_order', p_id, po.po_number, 'submitted', 'draft', 'for_approval', null);
end;
$$;

create or replace function public.approve_purchase_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  po public.purchase_orders%rowtype;
begin
  perform public.require_roles('admin');
  select * into po from public.purchase_orders where id = p_id for update;
  if po.status is distinct from 'for_approval' then
    raise exception 'Only a purchase order awaiting approval can be approved';
  end if;
  update public.purchase_orders
  set status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_by = auth.uid()
  where id = p_id;
  perform public.record_purchasing_event('purchase_order', p_id, po.po_number, 'approved', 'for_approval', 'approved', null);
end;
$$;

create or replace function public.cancel_purchase_order(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  po public.purchase_orders%rowtype;
begin
  perform public.require_roles('admin');
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Cancellation reason is required';
  end if;
  select * into po from public.purchase_orders where id = p_id for update;
  if po.id is null or po.status in ('cancelled', 'closed') then
    raise exception 'Purchase order cannot be cancelled';
  end if;
  if exists (
    select 1 from public.bills_of_lading b
    where b.purchase_order_id = p_id and b.status <> 'cancelled'
  ) then
    raise exception 'Cancellation cannot continue because subsequent transactions exist';
  end if;
  update public.purchase_orders
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
      cancellation_reason = btrim(p_reason), updated_by = auth.uid()
  where id = p_id;
  perform public.record_purchasing_event('purchase_order', p_id, po.po_number, 'cancelled', po.status::text, 'cancelled', p_reason);
end;
$$;

create or replace function public.close_purchase_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  po public.purchase_orders%rowtype;
begin
  perform public.require_roles('admin');
  select * into po from public.purchase_orders where id = p_id for update;
  if po.status not in ('approved', 'partially_shipped', 'fully_shipped', 'partially_received', 'completed') then
    raise exception 'This purchase order cannot be closed';
  end if;
  update public.purchase_orders
  set status = 'closed', closed_by = auth.uid(), closed_at = now(), updated_by = auth.uid()
  where id = p_id;
  perform public.record_purchasing_event('purchase_order', p_id, po.po_number, 'closed', po.status::text, 'closed', null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Bill of lading RPCs
-- ---------------------------------------------------------------------------

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
  if payload is null or jsonb_typeof(payload->'lines') <> 'array' then
    raise exception 'Bill of lading needs at least one item';
  end if;
  for line in select value from jsonb_array_elements(payload->'lines')
  loop
    qty := public.round_money(coalesce((line->>'shipped_qty')::numeric, 0));
    if qty <= 0 then
      continue;
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

create or replace function public.post_bill_of_lading(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bol public.bills_of_lading%rowtype;
  line public.bill_of_lading_items%rowtype;
  poi public.purchase_order_items%rowtype;
  remaining numeric;
  updated_id uuid;
begin
  perform public.require_roles('admin', 'warehouse');
  select * into bol from public.bills_of_lading where id = p_id for update;
  if bol.id is null then
    raise exception 'Bill of lading was not found';
  end if;
  if bol.status <> 'draft' then
    raise exception 'This Bill of Lading has already been posted.';
  end if;
  perform 1 from public.purchase_orders where id = bol.purchase_order_id for update;
  for line in
    select * from public.bill_of_lading_items where bill_of_lading_id = p_id order by sort_order
  loop
    select * into poi from public.purchase_order_items where id = line.purchase_order_item_id for update;
    remaining := public.round_money(poi.ordered_qty - poi.shipped_qty);
    if line.shipped_qty > remaining then
      raise exception 'Available quantity has changed. Please refresh the document.';
    end if;
    update public.purchase_order_items
    set shipped_qty = public.round_money(shipped_qty + line.shipped_qty)
    where id = poi.id;
  end loop;
  update public.bills_of_lading
  set status = 'posted', posted_by = auth.uid(), posted_at = now(), updated_by = auth.uid()
  where id = p_id and status = 'draft'
  returning id into updated_id;
  if updated_id is null then
    raise exception 'This Bill of Lading has already been posted.';
  end if;
  perform public.record_purchasing_event('bill_of_lading', p_id, bol.bol_number, 'posted', 'draft', 'posted', null);
  perform public.refresh_purchase_order_status(bol.purchase_order_id);
end;
$$;

create or replace function public.mark_bill_of_lading_transit(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bol public.bills_of_lading%rowtype;
begin
  perform public.require_roles('admin', 'warehouse');
  select * into bol from public.bills_of_lading where id = p_id for update;
  if bol.status is distinct from 'posted' then
    raise exception 'Only a posted bill of lading can be marked in transit';
  end if;
  update public.bills_of_lading set status = 'in_transit', updated_by = auth.uid() where id = p_id;
  perform public.record_purchasing_event('bill_of_lading', p_id, bol.bol_number, 'in_transit', 'posted', 'in_transit', null);
end;
$$;

create or replace function public.mark_bill_of_lading_arrived(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bol public.bills_of_lading%rowtype;
begin
  perform public.require_roles('admin', 'warehouse');
  select * into bol from public.bills_of_lading where id = p_id for update;
  if bol.status not in ('posted', 'in_transit') then
    raise exception 'Only a posted or in-transit bill of lading can be marked arrived';
  end if;
  update public.bills_of_lading set status = 'arrived', updated_by = auth.uid() where id = p_id;
  perform public.record_purchasing_event('bill_of_lading', p_id, bol.bol_number, 'arrived', bol.status::text, 'arrived', null);
end;
$$;

create or replace function public.cancel_bill_of_lading(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bol public.bills_of_lading%rowtype;
  line public.bill_of_lading_items%rowtype;
begin
  perform public.require_roles('admin', 'warehouse');
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Cancellation reason is required';
  end if;
  select * into bol from public.bills_of_lading where id = p_id for update;
  if bol.id is null or bol.status = 'cancelled' then
    raise exception 'Bill of lading cannot be cancelled';
  end if;
  if exists (
    select 1 from public.receiving_reports rr
    where rr.bill_of_lading_id = p_id and rr.status <> 'cancelled'
  ) then
    raise exception 'Cancellation cannot continue because subsequent transactions exist';
  end if;
  if bol.status <> 'draft' then
    perform 1 from public.purchase_orders where id = bol.purchase_order_id for update;
    for line in select * from public.bill_of_lading_items where bill_of_lading_id = p_id
    loop
      update public.purchase_order_items
      set shipped_qty = public.round_money(shipped_qty - line.shipped_qty)
      where id = line.purchase_order_item_id;
    end loop;
  end if;
  update public.bills_of_lading
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
      cancellation_reason = btrim(p_reason), updated_by = auth.uid()
  where id = p_id;
  perform public.record_purchasing_event('bill_of_lading', p_id, bol.bol_number, 'cancelled', bol.status::text, 'cancelled', p_reason);
  perform public.refresh_purchase_order_status(bol.purchase_order_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Receiving report RPCs
-- ---------------------------------------------------------------------------

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

create or replace function public.post_receiving_report(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rr public.receiving_reports%rowtype;
  line public.receiving_report_items%rowtype;
  bli public.bill_of_lading_items%rowtype;
  expected numeric;
  actual numeric;
  v_short numeric;
  v_excess numeric;
  updated_id uuid;
  movement_id uuid;
begin
  perform public.require_roles('admin', 'warehouse');
  select * into rr from public.receiving_reports where id = p_id for update;
  if rr.id is null then
    raise exception 'Receiving report was not found';
  end if;
  if rr.status <> 'draft' then
    raise exception 'This Receiving Report has already been posted.';
  end if;
  perform 1 from public.bills_of_lading where id = rr.bill_of_lading_id for update;
  perform 1 from public.purchase_orders where id = rr.purchase_order_id for update;

  for line in
    select * from public.receiving_report_items where receiving_report_id = p_id order by sort_order
  loop
    select * into bli from public.bill_of_lading_items where id = line.bol_item_id for update;
    expected := public.round_money(bli.shipped_qty - bli.received_qty);
    actual := public.round_money(line.good_qty + line.damaged_qty);
    if actual <> line.actual_received_qty then
      raise exception 'Receiving quantities are invalid';
    end if;
    v_excess := public.round_money(greatest(actual - expected, 0));
    if line.record_short then
      v_short := public.round_money(greatest(expected - actual, 0));
    else
      v_short := 0;
    end if;
    if v_excess > 0 and not line.accept_excess then
      raise exception 'Receiving quantity exceeds remaining BOL quantity.';
    end if;
    if (v_short > 0 or line.damaged_qty > 0 or v_excess > 0) and nullif(btrim(coalesce(line.remarks, '')), '') is null then
      raise exception 'Remarks are required for a short, damaged, or excess receipt';
    end if;
    update public.receiving_report_items
    set previously_received_qty = bli.received_qty,
        short_qty = v_short,
        excess_qty = v_excess
    where id = line.id;
    update public.bill_of_lading_items
    set received_qty = public.round_money(received_qty + actual)
    where id = bli.id;
    update public.purchase_order_items
    set received_qty = public.round_money(received_qty + actual)
    where id = line.purchase_order_item_id;
    if line.good_qty > 0 then
      insert into public.inventory_movements (
        warehouse_id, item_id, quantity, source_type, source_id, source_line_id
      ) values (
        rr.warehouse_id, line.item_id, line.good_qty, 'receiving_report', rr.id, line.id
      ) returning id into movement_id;
      perform public.record_purchasing_event(
        'inventory_movement', movement_id, rr.rr_number, 'received', null, null, line.item_name
      );
    end if;
    if v_short > 0 then
      insert into public.receiving_discrepancies (receiving_report_item_id, discrepancy_type, quantity, remarks)
      values (line.id, 'short', v_short, line.remarks);
    end if;
    if line.damaged_qty > 0 then
      insert into public.receiving_discrepancies (receiving_report_item_id, discrepancy_type, quantity, remarks)
      values (line.id, 'damaged', line.damaged_qty, line.remarks);
    end if;
    if v_excess > 0 then
      insert into public.receiving_discrepancies (receiving_report_item_id, discrepancy_type, quantity, remarks)
      values (line.id, 'excess', v_excess, line.remarks);
    end if;
  end loop;

  update public.receiving_reports
  set status = 'posted', posted_by = auth.uid(), posted_at = now(), updated_by = auth.uid()
  where id = p_id and status = 'draft'
  returning id into updated_id;
  if updated_id is null then
    raise exception 'This Receiving Report has already been posted.';
  end if;
  perform public.record_purchasing_event('receiving_report', p_id, rr.rr_number, 'posted', 'draft', 'posted', null);
  perform public.refresh_bol_status(rr.bill_of_lading_id);
  perform public.refresh_purchase_order_status(rr.purchase_order_id);
end;
$$;

create or replace function public.cancel_receiving_report(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rr public.receiving_reports%rowtype;
  line public.receiving_report_items%rowtype;
  movement public.inventory_movements%rowtype;
  on_hand numeric;
  reserved numeric;
begin
  perform public.require_roles('admin', 'warehouse');
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Cancellation reason is required';
  end if;
  select * into rr from public.receiving_reports where id = p_id for update;
  if rr.status is distinct from 'posted' then
    raise exception 'Only a posted receiving report can be reversed';
  end if;
  perform 1 from public.bills_of_lading where id = rr.bill_of_lading_id for update;
  perform 1 from public.purchase_orders where id = rr.purchase_order_id for update;
  for line in select * from public.receiving_report_items where receiving_report_id = p_id
  loop
    if line.good_qty > 0 then
      on_hand := public.inventory_on_hand(rr.warehouse_id, line.item_id);
      reserved := public.inventory_reserved(rr.warehouse_id, line.item_id);
      if public.round_money(on_hand - line.good_qty) < reserved then
        raise exception 'Cancellation cannot continue because subsequent transactions exist.';
      end if;
    end if;
  end loop;
  for line in select * from public.receiving_report_items where receiving_report_id = p_id
  loop
    update public.bill_of_lading_items
    set received_qty = public.round_money(received_qty - line.actual_received_qty)
    where id = line.bol_item_id;
    update public.purchase_order_items
    set received_qty = public.round_money(received_qty - line.actual_received_qty)
    where id = line.purchase_order_item_id;
    if line.good_qty > 0 then
      select * into movement
      from public.inventory_movements
      where source_type = 'receiving_report'
        and source_id = rr.id
        and source_line_id = line.id
        and quantity > 0
        and reverses_movement_id is null
      order by occurred_at
      limit 1;
      insert into public.inventory_movements (
        warehouse_id, item_id, quantity, source_type, source_id, source_line_id, reverses_movement_id
      ) values (
        rr.warehouse_id, line.item_id, public.round_money(line.good_qty * -1),
        'receiving_report', rr.id, line.id, movement.id
      );
      perform public.record_purchasing_event(
        'inventory_movement', movement.id, rr.rr_number, 'reversed', null, null, p_reason
      );
    end if;
  end loop;
  update public.receiving_reports
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
      cancellation_reason = btrim(p_reason), updated_by = auth.uid()
  where id = p_id;
  perform public.record_purchasing_event('receiving_report', p_id, rr.rr_number, 'cancelled', 'posted', 'cancelled', p_reason);
  perform public.refresh_bol_status(rr.bill_of_lading_id);
  perform public.refresh_purchase_order_status(rr.purchase_order_id);
end;
$$;

create or replace function public.resolve_receiving_discrepancy(p_id uuid, p_status public.discrepancy_status, p_remarks text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  disc public.receiving_discrepancies%rowtype;
  po_id uuid;
begin
  perform public.require_roles('admin', 'warehouse');
  if p_status is null or p_status = 'open' then
    raise exception 'Choose a resolution status';
  end if;
  if nullif(btrim(coalesce(p_remarks, '')), '') is null then
    raise exception 'Resolution remarks are required';
  end if;
  select * into disc from public.receiving_discrepancies where id = p_id for update;
  if disc.id is null or disc.status <> 'open' then
    raise exception 'This discrepancy is already resolved';
  end if;
  update public.receiving_discrepancies
  set status = p_status, resolution_remarks = btrim(p_remarks), resolved_by = auth.uid(), resolved_at = now()
  where id = p_id;
  select rr.purchase_order_id into po_id
  from public.receiving_report_items ri
  join public.receiving_reports rr on rr.id = ri.receiving_report_id
  where ri.id = disc.receiving_report_item_id;
  perform public.record_purchasing_event(
    'receiving_discrepancy', p_id, null, 'resolved', 'open', p_status::text, p_remarks
  );
  perform public.refresh_purchase_order_status(po_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.bills_of_lading enable row level security;
alter table public.bill_of_lading_items enable row level security;
alter table public.receiving_reports enable row level security;
alter table public.receiving_report_items enable row level security;
alter table public.receiving_discrepancies enable row level security;
alter table public.purchasing_events enable row level security;

create policy suppliers_select on public.suppliers for select using (public.is_active_user());
create policy suppliers_write on public.suppliers
for insert with check (public.current_user_role() = 'admin');
create policy suppliers_update on public.suppliers
for update using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy purchase_orders_select on public.purchase_orders for select using (public.is_active_user());
create policy purchase_order_items_select on public.purchase_order_items for select using (public.is_active_user());
create policy bills_of_lading_select on public.bills_of_lading for select using (public.is_active_user());
create policy bill_of_lading_items_select on public.bill_of_lading_items for select using (public.is_active_user());
create policy receiving_reports_select on public.receiving_reports for select using (public.is_active_user());
create policy receiving_report_items_select on public.receiving_report_items for select using (public.is_active_user());
create policy receiving_discrepancies_select on public.receiving_discrepancies for select using (public.is_active_user());
create policy purchasing_events_select on public.purchasing_events for select using (public.is_active_user());

grant select on public.suppliers, public.purchase_orders, public.purchase_order_items,
  public.bills_of_lading, public.bill_of_lading_items, public.receiving_reports,
  public.receiving_report_items, public.receiving_discrepancies, public.purchasing_events
  to authenticated;
grant insert, update on public.suppliers to authenticated;

revoke all on function public.record_purchasing_event(text, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.refresh_bol_status(uuid) from public, anon, authenticated;
revoke all on function public.refresh_purchase_order_status(uuid) from public, anon, authenticated;

grant execute on function public.create_purchase_order(jsonb) to authenticated;
grant execute on function public.update_purchase_order(uuid, jsonb) to authenticated;
grant execute on function public.submit_purchase_order(uuid) to authenticated;
grant execute on function public.approve_purchase_order(uuid) to authenticated;
grant execute on function public.cancel_purchase_order(uuid, text) to authenticated;
grant execute on function public.close_purchase_order(uuid) to authenticated;
grant execute on function public.create_bill_of_lading(jsonb) to authenticated;
grant execute on function public.post_bill_of_lading(uuid) to authenticated;
grant execute on function public.mark_bill_of_lading_transit(uuid) to authenticated;
grant execute on function public.mark_bill_of_lading_arrived(uuid) to authenticated;
grant execute on function public.cancel_bill_of_lading(uuid, text) to authenticated;
grant execute on function public.create_receiving_report(jsonb) to authenticated;
grant execute on function public.post_receiving_report(uuid) to authenticated;
grant execute on function public.cancel_receiving_report(uuid, text) to authenticated;
grant execute on function public.resolve_receiving_discrepancy(uuid, public.discrepancy_status, text) to authenticated;
