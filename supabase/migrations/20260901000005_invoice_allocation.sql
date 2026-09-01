-- Clearer fully-invoiced rejection. create_invoice already locks the SO header and lines (FOR UPDATE).

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

comment on function public.create_invoice(jsonb) is
  'Creates an invoice from an open sales order. Locks the SO header and lines (FOR UPDATE) so concurrent invoices cannot over-allocate remaining qty.';
