-- Phase 1 foundation: indexes, amount/header checks, lineage triggers.
-- Additive. Do not edit prior migrations.

-- ---------------------------------------------------------------------------
-- Indexes (status, dates, document type, remaining FKs)
-- ---------------------------------------------------------------------------

create index customers_status_idx on public.customers (status);
create index items_status_idx on public.items (status);
create index users_status_idx on public.users (status);
create index users_role_idx on public.users (role);

create index invoices_order_date_idx on public.invoices (order_date);
create index atw_documents_type_idx on public.atw_documents (document_type);
create index atw_documents_date_idx on public.atw_documents (order_date);
create index withdrawal_slips_status_idx on public.withdrawal_slips (status);
create index withdrawal_slips_invoice_idx on public.withdrawal_slips (invoice_id);
create index withdrawal_slips_date_idx on public.withdrawal_slips (order_date);

-- ---------------------------------------------------------------------------
-- Header non-negativity and document-number shape
-- ---------------------------------------------------------------------------

alter table public.sales_orders
  add constraint sales_orders_totals_nonneg
    check (total_quantity >= 0 and grand_total >= 0),
  add constraint sales_orders_number_format
    check (so_number ~ '^SO-[0-9]{4}-[0-9]{4}$');

alter table public.invoices
  add constraint invoices_totals_nonneg
    check (total_quantity >= 0 and grand_total >= 0),
  add constraint invoices_number_required
    check (length(trim(invoice_number)) > 0);

alter table public.atw_documents
  add constraint atw_documents_totals_nonneg
    check (total_quantity >= 0 and grand_total >= 0),
  add constraint atw_documents_number_format
    check (atw_number ~ '^ATW-[0-9]{4}-[0-9]{4}$');

alter table public.withdrawal_slips
  add constraint withdrawal_slips_totals_nonneg
    check (total_quantity >= 0 and grand_total >= 0),
  add constraint withdrawal_slips_number_format
    check (ws_number ~ '^WS-[0-9]{4}-[0-9]{4}$');

-- ---------------------------------------------------------------------------
-- Line amount rules (D9)
-- ---------------------------------------------------------------------------

alter table public.sales_order_items
  add constraint sales_order_items_amount_eq
    check (amount = round(quantity * unit_price, 2)),
  add constraint sales_order_items_total_eq
    check (total_amount = amount);

alter table public.invoice_items
  add constraint invoice_items_amount_eq
    check (amount = round(quantity * unit_price, 2)),
  add constraint invoice_items_total_eq
    check (total_amount = amount + tax_amount);

alter table public.atw_document_items
  add constraint atw_document_items_price_nonneg
    check (unit_price >= 0),
  add constraint atw_document_items_invoice_qty_nonneg
    check (invoice_item_quantity >= 0),
  add constraint atw_document_items_amount_eq
    check (amount = round(quantity * unit_price, 2)),
  add constraint atw_document_items_total_eq
    check (total_amount = amount);

alter table public.withdrawal_slip_items
  add constraint withdrawal_slip_items_amount_nonneg
    check (amount >= 0),
  add constraint withdrawal_slip_items_total_eq
    check (total_amount = amount);

-- ---------------------------------------------------------------------------
-- Lineage: child rows must belong to the parent document chain
-- ---------------------------------------------------------------------------

create or replace function public.enforce_invoice_header_lineage()
returns trigger
language plpgsql
as $$
declare
  so_customer uuid;
begin
  select customer_id into so_customer
  from public.sales_orders
  where id = new.sales_order_id;
  if so_customer is null then
    raise exception 'Invoice sales order was not found';
  end if;
  if new.customer_id is distinct from so_customer then
    raise exception 'Invoice customer must match the sales order customer';
  end if;
  return new;
end;
$$;

create trigger invoices_enforce_header_lineage
before insert or update of sales_order_id, customer_id on public.invoices
for each row execute function public.enforce_invoice_header_lineage();

create or replace function public.enforce_invoice_item_lineage()
returns trigger
language plpgsql
as $$
declare
  invoice_so uuid;
  line_so uuid;
  line_item uuid;
begin
  select sales_order_id into invoice_so from public.invoices where id = new.invoice_id;
  select sales_order_id, item_id into line_so, line_item
  from public.sales_order_items
  where id = new.sales_order_item_id;
  if invoice_so is null or line_so is null then
    raise exception 'Invoice item lineage is incomplete';
  end if;
  if invoice_so is distinct from line_so then
    raise exception 'Invoice item must reference a sales order item on the same sales order';
  end if;
  if new.item_id is distinct from line_item then
    raise exception 'Invoice item item_id must match the sales order line';
  end if;
  return new;
end;
$$;

create trigger invoice_items_enforce_lineage
before insert or update of invoice_id, sales_order_item_id, item_id on public.invoice_items
for each row execute function public.enforce_invoice_item_lineage();

create or replace function public.enforce_atw_header_lineage()
returns trigger
language plpgsql
as $$
declare
  inv_so uuid;
  inv_customer uuid;
begin
  select sales_order_id, customer_id into inv_so, inv_customer
  from public.invoices
  where id = new.invoice_id;
  if inv_so is null then
    raise exception 'ATW/DR invoice was not found';
  end if;
  if new.sales_order_id is distinct from inv_so then
    raise exception 'ATW/DR sales order must match the invoice sales order';
  end if;
  if new.customer_id is distinct from inv_customer then
    raise exception 'ATW/DR customer must match the invoice customer';
  end if;
  return new;
end;
$$;

create trigger atw_documents_enforce_header_lineage
before insert or update of invoice_id, sales_order_id, customer_id on public.atw_documents
for each row execute function public.enforce_atw_header_lineage();

create or replace function public.enforce_atw_item_lineage()
returns trigger
language plpgsql
as $$
declare
  atw_invoice uuid;
  inv_invoice uuid;
  inv_so_item uuid;
  inv_item uuid;
begin
  select invoice_id into atw_invoice from public.atw_documents where id = new.atw_id;
  select invoice_id, sales_order_item_id, item_id
    into inv_invoice, inv_so_item, inv_item
  from public.invoice_items
  where id = new.invoice_item_id;
  if atw_invoice is null or inv_invoice is null then
    raise exception 'ATW/DR item lineage is incomplete';
  end if;
  if atw_invoice is distinct from inv_invoice then
    raise exception 'ATW/DR item must reference an invoice item on the same invoice';
  end if;
  if new.sales_order_item_id is distinct from inv_so_item then
    raise exception 'ATW/DR item sales_order_item_id must match the invoice line';
  end if;
  if new.item_id is distinct from inv_item then
    raise exception 'ATW/DR item item_id must match the invoice line';
  end if;
  return new;
end;
$$;

create trigger atw_document_items_enforce_lineage
before insert or update of atw_id, invoice_item_id, sales_order_item_id, item_id
on public.atw_document_items
for each row execute function public.enforce_atw_item_lineage();

create or replace function public.enforce_ws_header_lineage()
returns trigger
language plpgsql
as $$
declare
  atw_invoice uuid;
  atw_so uuid;
  atw_customer uuid;
begin
  select invoice_id, sales_order_id, customer_id
    into atw_invoice, atw_so, atw_customer
  from public.atw_documents
  where id = new.atw_id;
  if atw_invoice is null then
    raise exception 'Withdrawal slip ATW/DR was not found';
  end if;
  if new.invoice_id is distinct from atw_invoice then
    raise exception 'Withdrawal slip invoice must match the ATW/DR invoice';
  end if;
  if new.sales_order_id is distinct from atw_so then
    raise exception 'Withdrawal slip sales order must match the ATW/DR sales order';
  end if;
  if new.customer_id is distinct from atw_customer then
    raise exception 'Withdrawal slip customer must match the ATW/DR customer';
  end if;
  return new;
end;
$$;

create trigger withdrawal_slips_enforce_header_lineage
before insert or update of atw_id, invoice_id, sales_order_id, customer_id
on public.withdrawal_slips
for each row execute function public.enforce_ws_header_lineage();

create or replace function public.enforce_ws_item_lineage()
returns trigger
language plpgsql
as $$
declare
  slip_atw uuid;
  line_atw uuid;
  line_inv_item uuid;
  line_so_item uuid;
  line_item uuid;
  line_qty numeric;
begin
  select atw_id into slip_atw from public.withdrawal_slips where id = new.withdrawal_slip_id;
  select atw_id, invoice_item_id, sales_order_item_id, item_id, quantity
    into line_atw, line_inv_item, line_so_item, line_item, line_qty
  from public.atw_document_items
  where id = new.atw_item_id;
  if slip_atw is null or line_atw is null then
    raise exception 'Withdrawal slip item lineage is incomplete';
  end if;
  if slip_atw is distinct from line_atw then
    raise exception 'Withdrawal slip item must reference an ATW/DR item on the same ATW/DR';
  end if;
  if new.invoice_item_id is distinct from line_inv_item
     or new.sales_order_item_id is distinct from line_so_item
     or new.item_id is distinct from line_item then
    raise exception 'Withdrawal slip item lineage must match the ATW/DR line';
  end if;
  if new.quantity is distinct from line_qty then
    raise exception 'Withdrawal slip line quantity must match the ATW/DR line';
  end if;
  return new;
end;
$$;

create trigger withdrawal_slip_items_enforce_lineage
before insert or update of withdrawal_slip_id, atw_item_id, invoice_item_id,
  sales_order_item_id, item_id, quantity
on public.withdrawal_slip_items
for each row execute function public.enforce_ws_item_lineage();

comment on table public.users is 'App profile 1:1 with auth.users. No password column.';
comment on table public.document_sequences is 'Monotonic counters for SO/ATW/WS numbers. Invoice numbers are typed.';
comment on table public.customers is 'Customer master. UUID PK only.';
comment on table public.items is 'Catalog item master. Serial/barcode copied to lines.';
comment on table public.sales_orders is 'Sales order header. Number SO-YYYY-NNNN.';
comment on table public.invoices is 'Invoice header. invoice_number is typed from pre-printed stock.';
comment on table public.atw_documents is 'ATW and DR share this table; document_type distinguishes them.';
comment on table public.withdrawal_slips is 'One non-cancelled withdrawal slip per ATW (partial unique index).';
comment on function public.next_doc_number(text, text) is
  'Returns PREFIX + Asia/Manila year + hyphen + 4-digit sequence. Used for SO, ATW, WS only.';
