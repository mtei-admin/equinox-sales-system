-- Invoice remaining for ATW/DR. create_atw_document already locks the invoice header and lines (FOR UPDATE).

create or replace function public.invoice_item_remaining_qty(p_invoice_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.round_money(line_row.quantity - public.invoice_item_atw_qty(line_row.id))
  from public.invoice_items as line_row
  where line_row.id = p_invoice_item_id;
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

grant execute on function public.invoice_item_remaining_qty(uuid) to authenticated;

comment on function public.invoice_item_remaining_qty(uuid) is
  'Invoice qty minus non-cancelled ATW/DR qty on that invoice item.';

comment on function public.create_atw_document(jsonb) is
  'Creates an ATW/DR from a posted invoice. Locks the invoice header and lines (FOR UPDATE) so concurrent ATW/DR documents cannot over-allocate remaining qty.';
