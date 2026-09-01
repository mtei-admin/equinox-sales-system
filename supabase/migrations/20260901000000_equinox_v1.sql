-- Equinox v1: replace prototype schema (D21). Do not edit 20240901000000_init.sql.

-- ---------------------------------------------------------------------------
-- Drop prototype
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
drop trigger if exists profiles_set_updated_at on public.profiles;

drop table if exists public.withdrawal_slip_lines cascade;
drop table if exists public.withdrawal_slips cascade;
drop table if exists public.atw_dr_lines cascade;
drop table if exists public.atw_dr cascade;
drop table if exists public.invoice_lines cascade;
drop table if exists public.invoices cascade;
drop table if exists public.sales_order_lines cascade;
drop table if exists public.sales_orders cascade;
drop table if exists public.items cascade;
drop table if exists public.customers cascade;
drop table if exists public.document_sequences cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.prevent_profile_privilege_escalation() cascade;
drop function if exists public.current_profile_role() cascade;
drop function if exists public.is_active_user() cascade;
drop function if exists public.next_doc_number(text, text) cascade;
drop function if exists public.set_updated_at() cascade;

drop type if exists public.user_role cascade;
drop type if exists public.so_status cascade;
drop type if exists public.invoice_status cascade;
drop type if exists public.atw_status cascade;
drop type if exists public.ws_status cascade;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('admin', 'sales', 'warehouse', 'accounting');
create type public.master_status as enum ('active', 'inactive');
create type public.so_status as enum ('draft', 'open', 'closed', 'cancelled');
create type public.invoice_status as enum ('draft', 'posted', 'cancelled');
create type public.atw_status as enum ('draft', 'released', 'cancelled');
create type public.ws_status as enum ('draft', 'issued', 'cancelled');
create type public.atw_document_type as enum ('atw', 'dr');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.round_money(p numeric)
returns numeric
language sql
immutable
as $$
  select round(coalesce(p, 0), 2);
$$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text not null default '',
  department text,
  role public.user_role not null default 'accounting',
  status public.master_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users
  where id = auth.uid() and status = 'active'
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and status = 'active'
  )
$$;

create or replace function public.require_roles(variadic p_roles public.user_role[])
returns public.user_role
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.user_role;
begin
  r := public.current_user_role();
  if r is null or not (r = any (p_roles)) then
    raise exception 'Not authorized';
  end if;
  return r;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned public.user_role;
  uname text;
begin
  if not exists (select 1 from public.users) then
    assigned := 'admin';
  else
    assigned := coalesce(nullif(new.raw_user_meta_data->>'role', '')::public.user_role, 'accounting');
  end if;

  uname := coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email, new.id::text), '@', 1));

  insert into public.users (id, username, full_name, role)
  values (
    new.id,
    uname,
    coalesce(new.raw_user_meta_data->>'full_name', uname),
    assigned
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.prevent_user_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role or new.status is distinct from old.status then
    if public.current_user_role() is distinct from 'admin' then
      raise exception 'Only admin can change role or status';
    end if;
  end if;
  return new;
end;
$$;

create trigger users_prevent_privilege_escalation
before update on public.users
for each row execute function public.prevent_user_privilege_escalation();

-- ---------------------------------------------------------------------------
-- Sequences
-- ---------------------------------------------------------------------------

create table public.document_sequences (
  doc_type text primary key,
  last_number integer not null default 0
);

insert into public.document_sequences (doc_type) values ('sales_order'), ('atw'), ('withdrawal_slip');

create or replace function public.next_doc_number(p_doc_type text, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_n integer;
begin
  update public.document_sequences
  set last_number = last_number + 1
  where doc_type = p_doc_type
  returning last_number into next_n;
  if next_n is null then
    raise exception 'Unknown document type: %', p_doc_type;
  end if;
  return p_prefix || to_char(now() at time zone 'Asia/Manila', 'YYYY') || '-' || lpad(next_n::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Master data
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  billing_address text,
  tin_number text,
  status public.master_status not null default 'active',
  contact_person text,
  contact_number text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  brand text,
  model text,
  serial_no text,
  barcode text,
  status public.master_status not null default 'active',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

create index items_barcode_idx on public.items (barcode);
create index items_serial_idx on public.items (serial_no);
create index items_model_idx on public.items (model);

-- ---------------------------------------------------------------------------
-- Sales orders
-- ---------------------------------------------------------------------------

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  so_number text not null unique,
  customer_id uuid not null references public.customers (id) on delete restrict,
  customer_name text not null,
  delivery_address text,
  order_date date not null default (timezone('Asia/Manila', now()))::date,
  term text,
  reference_no text,
  order_type text,
  sales_employee_id uuid references public.users (id) on delete set null,
  sales_employee_name text,
  total_quantity numeric(14, 2) not null default 0,
  grand_total numeric(14, 2) not null default 0,
  status public.so_status not null default 'draft',
  remarks text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  cancelled_by uuid references public.users (id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text
);

create trigger sales_orders_set_updated_at
before update on public.sales_orders
for each row execute function public.set_updated_at();

create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  model text,
  serial_no text,
  barcode text,
  description text,
  quantity numeric(14, 2) not null check (quantity > 0),
  uom text not null default 'PCS',
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  sort_order integer not null default 0
);

create index sales_orders_customer_idx on public.sales_orders (customer_id);
create index sales_orders_status_idx on public.sales_orders (status);
create index sales_orders_date_idx on public.sales_orders (order_date);
create index sales_order_items_so_idx on public.sales_order_items (sales_order_id);
create index sales_order_items_item_idx on public.sales_order_items (item_id);

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  sales_order_id uuid not null references public.sales_orders (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  customer_name text not null,
  delivery_address text,
  order_date date not null,
  term text,
  reference_no text,
  order_type text,
  sales_employee_id uuid references public.users (id) on delete set null,
  sales_employee_name text,
  total_quantity numeric(14, 2) not null default 0,
  grand_total numeric(14, 2) not null default 0,
  status public.invoice_status not null default 'draft',
  remarks text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  cancelled_by uuid references public.users (id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text
);

create unique index invoices_number_active_uidx
  on public.invoices (invoice_number)
  where status <> 'cancelled';

create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  sales_order_item_id uuid not null references public.sales_order_items (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  model text,
  serial_no text,
  barcode text,
  description text,
  quantity numeric(14, 2) not null check (quantity > 0),
  uom text not null default 'PCS',
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  tax_amount numeric(14, 2) not null default 0 check (tax_amount >= 0),
  amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  sort_order integer not null default 0
);

create index invoices_so_idx on public.invoices (sales_order_id);
create index invoices_customer_idx on public.invoices (customer_id);
create index invoices_status_idx on public.invoices (status);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id);
create index invoice_items_so_item_idx on public.invoice_items (sales_order_item_id);

-- ---------------------------------------------------------------------------
-- ATW / DR
-- ---------------------------------------------------------------------------

create table public.atw_documents (
  id uuid primary key default gen_random_uuid(),
  atw_number text not null unique,
  document_type public.atw_document_type not null default 'atw',
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  sales_order_id uuid not null references public.sales_orders (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  customer_name text not null,
  delivery_address text,
  order_date date not null,
  term text,
  reference_no text,
  order_type text,
  sales_employee_id uuid references public.users (id) on delete set null,
  sales_employee_name text,
  total_quantity numeric(14, 2) not null default 0,
  grand_total numeric(14, 2) not null default 0,
  status public.atw_status not null default 'draft',
  remarks text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  cancelled_by uuid references public.users (id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text
);

create trigger atw_documents_set_updated_at
before update on public.atw_documents
for each row execute function public.set_updated_at();

create table public.atw_document_items (
  id uuid primary key default gen_random_uuid(),
  atw_id uuid not null references public.atw_documents (id) on delete restrict,
  invoice_item_id uuid not null references public.invoice_items (id) on delete restrict,
  sales_order_item_id uuid not null references public.sales_order_items (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  model text,
  serial_no text,
  barcode text,
  description text,
  invoice_item_quantity numeric(14, 2) not null default 0,
  quantity numeric(14, 2) not null check (quantity > 0),
  uom text not null default 'PCS',
  unit_price numeric(14, 2) not null default 0,
  amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  sort_order integer not null default 0
);

create index atw_documents_invoice_idx on public.atw_documents (invoice_id);
create index atw_documents_so_idx on public.atw_documents (sales_order_id);
create index atw_documents_status_idx on public.atw_documents (status);
create index atw_document_items_header_idx on public.atw_document_items (atw_id);
create index atw_document_items_inv_item_idx on public.atw_document_items (invoice_item_id);

-- ---------------------------------------------------------------------------
-- Withdrawal slips
-- ---------------------------------------------------------------------------

create table public.withdrawal_slips (
  id uuid primary key default gen_random_uuid(),
  ws_number text not null unique,
  atw_id uuid not null references public.atw_documents (id) on delete restrict,
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  sales_order_id uuid not null references public.sales_orders (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  customer_name text not null,
  delivery_address text,
  order_date date not null,
  term text,
  reference_no text,
  order_type text,
  sales_employee_id uuid references public.users (id) on delete set null,
  sales_employee_name text,
  total_quantity numeric(14, 2) not null default 0,
  grand_total numeric(14, 2) not null default 0,
  status public.ws_status not null default 'draft',
  remarks text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  cancelled_by uuid references public.users (id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text
);

create unique index withdrawal_slips_one_active_per_atw
  on public.withdrawal_slips (atw_id)
  where status <> 'cancelled';

create trigger withdrawal_slips_set_updated_at
before update on public.withdrawal_slips
for each row execute function public.set_updated_at();

create table public.withdrawal_slip_items (
  id uuid primary key default gen_random_uuid(),
  withdrawal_slip_id uuid not null references public.withdrawal_slips (id) on delete restrict,
  atw_item_id uuid not null references public.atw_document_items (id) on delete restrict,
  invoice_item_id uuid not null references public.invoice_items (id) on delete restrict,
  sales_order_item_id uuid not null references public.sales_order_items (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  model text,
  serial_no text,
  barcode text,
  description text,
  quantity numeric(14, 2) not null check (quantity > 0),
  uom text not null default 'PCS',
  amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  sort_order integer not null default 0
);

create index withdrawal_slips_atw_idx on public.withdrawal_slips (atw_id);
create index withdrawal_slips_so_idx on public.withdrawal_slips (sales_order_id);
create index withdrawal_slip_items_header_idx on public.withdrawal_slip_items (withdrawal_slip_id);
create index withdrawal_slip_items_atw_item_idx on public.withdrawal_slip_items (atw_item_id);
