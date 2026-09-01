-- One non-cancelled withdrawal slip per ATW/DR. create_withdrawal_slip locks the ATW header
-- and lines (FOR UPDATE). The partial unique index is the concurrent last line of defense.

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
    ws_number, atw_id, invoice_id, sales_order_id, customer_id, customer_name, delivery_address,
    order_date, term, reference_no, order_type, sales_employee_id, sales_employee_name, remarks, created_by, updated_by
  ) values (
    public.next_doc_number('withdrawal_slip', 'WS-'),
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

create or replace function public.update_withdrawal_slip(p_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ws public.withdrawal_slips%rowtype;
  expected_n int;
  line jsonb;
  expected_qty numeric;
begin
  perform public.require_roles('admin', 'warehouse');

  select * into ws from public.withdrawal_slips where id = p_id for update;
  if ws.id is null then
    raise exception 'Withdrawal slip not found';
  end if;
  if ws.status is distinct from 'draft' then
    raise exception 'Only a draft withdrawal slip can be edited';
  end if;

  perform 1 from public.atw_document_items where atw_id = ws.atw_id for update;

  if jsonb_typeof(payload->'lines') = 'array' and jsonb_array_length(payload->'lines') > 0 then
    select count(*) into expected_n from public.atw_document_items where atw_id = ws.atw_id;
    if jsonb_array_length(payload->'lines') <> expected_n then
      raise exception 'Withdrawal slip must copy every ATW/DR line';
    end if;
    for line in select * from jsonb_array_elements(payload->'lines')
    loop
      select quantity into expected_qty
      from public.atw_document_items as src
      where src.id = (line->>'atw_item_id')::uuid
        and src.atw_id = ws.atw_id;
      if expected_qty is null then
        raise exception 'Withdrawal slip is missing an ATW/DR line';
      end if;
      if (line->>'quantity')::numeric is distinct from expected_qty then
        raise exception 'Withdrawal slip quantity % must match ATW/DR quantity %',
          (line->>'quantity')::numeric, expected_qty;
      end if;
    end loop;
  end if;

  update public.withdrawal_slips
  set remarks = payload->>'remarks', updated_by = auth.uid()
  where id = p_id;
  return p_id;
end;
$$;

grant execute on function public.update_withdrawal_slip(uuid, jsonb) to authenticated;

comment on function public.create_withdrawal_slip(jsonb) is
  'Creates a withdrawal slip by copying every released ATW/DR line. Locks the ATW header and lines (FOR UPDATE). Concurrent duplicates fail the partial unique index.';

comment on function public.update_withdrawal_slip(uuid, jsonb) is
  'Updates remarks on a draft withdrawal slip. Line quantities must continue to match the ATW/DR and cannot be changed.';
