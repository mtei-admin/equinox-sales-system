-- Draft sales-order update + remaining-qty helper. Do not edit earlier migrations.

create or replace function public.so_item_remaining_qty(p_so_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.round_money(soi.quantity - public.so_item_invoiced_qty(soi.id))
  from public.sales_order_items soi
  where soi.id = p_so_item_id;
$$;

create or replace function public.update_sales_order(p_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.so_status;
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
  child_n int;
begin
  perform public.require_roles('admin', 'sales');

  select status into st from public.sales_orders where id = p_id for update;
  if st is null then
    raise exception 'Sales order not found';
  end if;
  if st is distinct from 'draft' then
    raise exception 'Only a draft sales order can be edited';
  end if;

  select count(*) into child_n
  from public.invoices
  where sales_order_id = p_id;
  if child_n > 0 then
    raise exception 'Cannot edit a sales order that has invoices';
  end if;

  select * into cust from public.customers where id = (payload->>'customer_id')::uuid;
  if cust.id is null or cust.status <> 'active' then
    raise exception 'Customer not found or inactive';
  end if;
  if coalesce(jsonb_array_length(payload->'lines'), 0) < 1 then
    raise exception 'At least one line is required';
  end if;

  select full_name into emp_name from public.users
  where id = nullif(payload->>'sales_employee_id', '')::uuid and status = 'active';

  update public.sales_orders
  set
    customer_id = cust.id,
    customer_name = cust.name,
    delivery_address = coalesce(nullif(payload->>'delivery_address', ''), cust.billing_address),
    order_date = coalesce((payload->>'order_date')::date, order_date),
    term = nullif(payload->>'term', ''),
    reference_no = nullif(payload->>'reference_no', ''),
    order_type = nullif(payload->>'order_type', ''),
    sales_employee_id = nullif(payload->>'sales_employee_id', '')::uuid,
    sales_employee_name = emp_name,
    remarks = nullif(payload->>'remarks', ''),
    updated_by = auth.uid()
  where id = p_id;

  delete from public.sales_order_items where sales_order_id = p_id;

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
    if price < 0 then
      raise exception 'Unit price cannot be negative';
    end if;
    amt := public.round_money(qty * price);
    sum_qty := sum_qty + qty;
    sum_tot := sum_tot + amt;
    insert into public.sales_order_items (
      sales_order_id, item_id, model, serial_no, barcode, description,
      quantity, uom, unit_price, amount, total_amount, sort_order
    ) values (
      p_id, it.id,
      coalesce(nullif(line->>'model', ''), it.model),
      coalesce(nullif(line->>'serial_no', ''), it.serial_no),
      coalesce(nullif(line->>'barcode', ''), it.barcode),
      coalesce(nullif(line->>'description', ''), it.description, it.name),
      qty, coalesce(nullif(line->>'uom', ''), 'PCS'), public.round_money(price), amt, amt, i
    );
  end loop;

  update public.sales_orders
  set total_quantity = public.round_money(sum_qty), grand_total = public.round_money(sum_tot)
  where id = p_id;
  return p_id;
end;
$$;

grant execute on function public.so_item_remaining_qty(uuid) to authenticated;
grant execute on function public.update_sales_order(uuid, jsonb) to authenticated;

comment on function public.update_sales_order(uuid, jsonb) is
  'Replaces header and lines on a draft sales order. Open/cancelled/closed orders cannot be edited.';
comment on function public.so_item_remaining_qty(uuid) is
  'SO remaining = SO qty − sum(non-cancelled invoice qty on that SO item).';
