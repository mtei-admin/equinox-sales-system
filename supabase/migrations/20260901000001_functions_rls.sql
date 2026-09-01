-- Remaining-qty helpers, document RPCs, RLS (depends on 20260901000000)

create or replace function public.so_item_invoiced_qty(p_so_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.round_money(coalesce(sum(ii.quantity), 0))
  from public.invoice_items ii
  join public.invoices i on i.id = ii.invoice_id
  where ii.sales_order_item_id = p_so_item_id
    and i.status <> 'cancelled';
$$;

create or replace function public.invoice_item_atw_qty(p_invoice_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.round_money(coalesce(sum(ai.quantity), 0))
  from public.atw_document_items ai
  join public.atw_documents a on a.id = ai.atw_id
  where ai.invoice_item_id = p_invoice_item_id
    and a.status <> 'cancelled';
$$;

create or replace function public.refresh_sales_order_closed(p_so_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  leftover numeric;
  st public.so_status;
begin
  select status into st from public.sales_orders where id = p_so_id for update;
  if st is null or st = 'cancelled' or st = 'draft' then
    return;
  end if;
  select public.round_money(coalesce(sum(soi.quantity - public.so_item_invoiced_qty(soi.id)), 0))
  into leftover
  from public.sales_order_items soi
  where soi.sales_order_id = p_so_id;
  if leftover <= 0 then
    update public.sales_orders set status = 'closed', updated_by = auth.uid() where id = p_so_id and status = 'open';
  elsif st = 'closed' then
    update public.sales_orders set status = 'open', updated_by = auth.uid() where id = p_so_id;
  end if;
end;
$$;

create or replace function public.stamp_cancel()
returns table (uid uuid, ts timestamptz)
language sql
stable
as $$
  select auth.uid(), now();
$$;

-- ---------------------------------------------------------------------------
-- create_sales_order
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
begin
  perform public.require_roles('admin', 'sales');

  select * into cust from public.customers where id = (payload->>'customer_id')::uuid;
  if cust.id is null or cust.status <> 'active' then
    raise exception 'Customer not found or inactive';
  end if;
  if coalesce(jsonb_array_length(payload->'lines'), 0) < 1 then
    raise exception 'At least one line is required';
  end if;

  select full_name into emp_name from public.users
  where id = nullif(payload->>'sales_employee_id', '')::uuid and status = 'active';

  insert into public.sales_orders (
    so_number, customer_id, customer_name, delivery_address, order_date, term, reference_no, order_type,
    sales_employee_id, sales_employee_name, remarks, created_by, updated_by
  ) values (
    public.next_doc_number('sales_order', 'SO-'),
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
begin
  perform public.require_roles('admin', 'sales');
  select status into st from public.sales_orders where id = p_id for update;
  if st is distinct from 'draft' then
    raise exception 'Only a draft sales order can be opened';
  end if;
  select count(*) into n from public.sales_order_items where sales_order_id = p_id;
  if n < 1 then
    raise exception 'At least one line is required';
  end if;
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

  insert into public.invoices (
    invoice_number, sales_order_id, customer_id, customer_name, delivery_address, order_date,
    term, reference_no, order_type, sales_employee_id, sales_employee_name, remarks, created_by, updated_by
  ) values (
    trim(payload->>'invoice_number'),
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

create or replace function public.post_invoice(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices%rowtype;
  n int;
begin
  perform public.require_roles('admin', 'sales');
  select * into inv from public.invoices where id = p_id for update;
  if inv.status is distinct from 'draft' then
    raise exception 'Only a draft invoice can be posted';
  end if;
  select count(*) into n from public.invoice_items where invoice_id = p_id;
  if n < 1 then
    raise exception 'Cannot post an empty invoice';
  end if;
  update public.invoices set status = 'posted', updated_by = auth.uid() where id = p_id;
  perform public.refresh_sales_order_closed(inv.sales_order_id);
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

  insert into public.atw_documents (
    atw_number, document_type, invoice_id, sales_order_id, customer_id, customer_name, delivery_address,
    order_date, term, reference_no, order_type, sales_employee_id, sales_employee_name, remarks, created_by, updated_by
  ) values (
    public.next_doc_number('atw', 'ATW-'),
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

create or replace function public.release_atw_document(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.atw_status;
  n int;
begin
  perform public.require_roles('admin', 'sales');
  select status into st from public.atw_documents where id = p_id for update;
  if st is distinct from 'draft' then
    raise exception 'Only a draft ATW/DR can be released';
  end if;
  select count(*) into n from public.atw_document_items where atw_id = p_id;
  if n < 1 then
    raise exception 'Cannot release an empty ATW/DR';
  end if;
  update public.atw_documents set status = 'released', updated_by = auth.uid() where id = p_id;
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
  ai public.atw_document_items%rowtype;
  amt numeric;
  i int := 0;
  sum_qty numeric := 0;
  sum_tot numeric := 0;
begin
  perform public.require_roles('admin', 'warehouse');

  select * into atw from public.atw_documents where id = (payload->>'atw_id')::uuid for update;
  if atw.id is null then
    raise exception 'ATW/DR not found';
  end if;
  if atw.status is distinct from 'released' then
    raise exception 'Withdrawal slip requires a released ATW/DR';
  end if;

  insert into public.withdrawal_slips (
    ws_number, atw_id, invoice_id, sales_order_id, customer_id, customer_name, delivery_address,
    order_date, term, reference_no, order_type, sales_employee_id, sales_employee_name, remarks, created_by, updated_by
  ) values (
    public.next_doc_number('withdrawal_slip', 'WS-'),
    atw.id, atw.invoice_id, atw.sales_order_id, atw.customer_id, atw.customer_name, atw.delivery_address,
    atw.order_date, atw.term, atw.reference_no, atw.order_type, atw.sales_employee_id, atw.sales_employee_name,
    payload->>'remarks', auth.uid(), auth.uid()
  ) returning id into new_id;

  for ai in select * from public.atw_document_items where atw_id = atw.id order by sort_order
  loop
    i := i + 1;
    amt := public.round_money(ai.quantity * ai.unit_price);
    sum_qty := sum_qty + ai.quantity;
    sum_tot := sum_tot + amt;
    insert into public.withdrawal_slip_items (
      withdrawal_slip_id, atw_item_id, invoice_item_id, sales_order_item_id, item_id,
      model, serial_no, barcode, description, quantity, uom, amount, total_amount, sort_order
    ) values (
      new_id, ai.id, ai.invoice_item_id, ai.sales_order_item_id, ai.item_id,
      ai.model, ai.serial_no, ai.barcode, ai.description, ai.quantity, ai.uom, amt, amt, i
    );
  end loop;

  if i < 1 then
    raise exception 'ATW/DR has no lines';
  end if;

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
  st public.ws_status;
begin
  perform public.require_roles('admin', 'warehouse');
  select status into st from public.withdrawal_slips where id = p_id for update;
  if st is distinct from 'draft' then
    raise exception 'Only a draft withdrawal slip can be issued';
  end if;
  update public.withdrawal_slips set status = 'issued', updated_by = auth.uid() where id = p_id;
end;
$$;

create or replace function public.cancel_sales_order(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.so_status;
  n int;
begin
  perform public.require_roles('admin', 'sales');
  select status into st from public.sales_orders where id = p_id for update;
  if st is null or st = 'cancelled' then
    raise exception 'Sales order cannot be cancelled';
  end if;
  select count(*) into n from public.invoices where sales_order_id = p_id and status <> 'cancelled';
  if n > 0 then
    raise exception 'Cancel invoices before cancelling this sales order';
  end if;
  update public.sales_orders
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
      cancellation_reason = p_reason, updated_by = auth.uid()
  where id = p_id;
end;
$$;

create or replace function public.cancel_invoice(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices%rowtype;
  n int;
begin
  perform public.require_roles('admin', 'sales');
  select * into inv from public.invoices where id = p_id for update;
  if inv.status is null or inv.status = 'cancelled' then
    raise exception 'Invoice cannot be cancelled';
  end if;
  select count(*) into n from public.atw_documents where invoice_id = p_id and status <> 'cancelled';
  if n > 0 then
    raise exception 'Cancel ATW/DR documents before cancelling this invoice';
  end if;
  update public.invoices
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
      cancellation_reason = p_reason, updated_by = auth.uid()
  where id = p_id;
  perform public.refresh_sales_order_closed(inv.sales_order_id);
end;
$$;

create or replace function public.cancel_atw_document(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.atw_status;
  n int;
begin
  perform public.require_roles('admin', 'sales');
  select status into st from public.atw_documents where id = p_id for update;
  if st is null or st = 'cancelled' then
    raise exception 'ATW/DR cannot be cancelled';
  end if;
  select count(*) into n from public.withdrawal_slips where atw_id = p_id and status <> 'cancelled';
  if n > 0 then
    raise exception 'Cancel the withdrawal slip before cancelling this ATW/DR';
  end if;
  update public.atw_documents
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
      cancellation_reason = p_reason, updated_by = auth.uid()
  where id = p_id;
end;
$$;

create or replace function public.cancel_withdrawal_slip(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.ws_status;
begin
  perform public.require_roles('admin', 'warehouse');
  select status into st from public.withdrawal_slips where id = p_id for update;
  if st is null or st = 'cancelled' then
    raise exception 'Withdrawal slip cannot be cancelled';
  end if;
  update public.withdrawal_slips
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
      cancellation_reason = p_reason, updated_by = auth.uid()
  where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.document_sequences enable row level security;
alter table public.customers enable row level security;
alter table public.items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.atw_documents enable row level security;
alter table public.atw_document_items enable row level security;
alter table public.withdrawal_slips enable row level security;
alter table public.withdrawal_slip_items enable row level security;

create policy users_select_active on public.users
for select using (public.is_active_user() and (status = 'active' or public.current_user_role() = 'admin'));

create policy users_update_self on public.users
for update using (auth.uid() = id and public.is_active_user())
with check (auth.uid() = id);

create policy users_admin_all on public.users
for all using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy document_sequences_select on public.document_sequences
for select using (public.is_active_user());

create policy customers_select on public.customers for select using (public.is_active_user());
create policy customers_write on public.customers
for all using (public.current_user_role() in ('admin', 'sales'))
with check (public.current_user_role() in ('admin', 'sales'));

create policy items_select on public.items for select using (public.is_active_user());
create policy items_write on public.items
for all using (public.current_user_role() in ('admin', 'sales'))
with check (public.current_user_role() in ('admin', 'sales'));

create policy so_select on public.sales_orders for select using (public.is_active_user());
create policy soi_select on public.sales_order_items for select using (public.is_active_user());
create policy inv_select on public.invoices for select using (public.is_active_user());
create policy invi_select on public.invoice_items for select using (public.is_active_user());
create policy atw_select on public.atw_documents for select using (public.is_active_user());
create policy atwi_select on public.atw_document_items for select using (public.is_active_user());
create policy ws_select on public.withdrawal_slips for select using (public.is_active_user());
create policy wsi_select on public.withdrawal_slip_items for select using (public.is_active_user());

grant usage on schema public to anon, authenticated;
grant select on public.users, public.document_sequences, public.customers, public.items,
  public.sales_orders, public.sales_order_items, public.invoices, public.invoice_items,
  public.atw_documents, public.atw_document_items, public.withdrawal_slips, public.withdrawal_slip_items
  to authenticated;
grant insert, update, delete on public.customers, public.items to authenticated;
grant update on public.users to authenticated;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.next_doc_number(text, text) to authenticated;
grant execute on function public.so_item_invoiced_qty(uuid) to authenticated;
grant execute on function public.invoice_item_atw_qty(uuid) to authenticated;
grant execute on function public.create_sales_order(jsonb) to authenticated;
grant execute on function public.open_sales_order(uuid) to authenticated;
grant execute on function public.create_invoice(jsonb) to authenticated;
grant execute on function public.post_invoice(uuid) to authenticated;
grant execute on function public.create_atw_document(jsonb) to authenticated;
grant execute on function public.release_atw_document(uuid) to authenticated;
grant execute on function public.create_withdrawal_slip(jsonb) to authenticated;
grant execute on function public.issue_withdrawal_slip(uuid) to authenticated;
grant execute on function public.cancel_sales_order(uuid, text) to authenticated;
grant execute on function public.cancel_invoice(uuid, text) to authenticated;
grant execute on function public.cancel_atw_document(uuid, text) to authenticated;
grant execute on function public.cancel_withdrawal_slip(uuid, text) to authenticated;
