-- Equinox Sales System — initial schema, RLS, and auth trigger

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('admin', 'sales', 'accounting', 'warehouse', 'viewer');
create type public.so_status as enum ('draft', 'confirmed', 'partially_invoiced', 'invoiced', 'cancelled');
create type public.invoice_status as enum ('draft', 'posted', 'partially_paid', 'paid', 'cancelled');
create type public.atw_status as enum ('draft', 'released', 'partially_withdrawn', 'completed', 'cancelled');
create type public.ws_status as enum ('draft', 'issued', 'cancelled');

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

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.current_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
  )
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role public.user_role;
begin
  select case when not exists (select 1 from public.profiles) then 'admin' else 'viewer' end
  into assigned_role;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    assigned_role
  );

  return new;
end;
$$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    if public.current_profile_role() is distinct from 'admin' then
      raise exception 'Only admin can change role or active flag';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_privilege_escalation
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Sequences
-- ---------------------------------------------------------------------------

create table public.document_sequences (
  doc_type text primary key,
  last_number integer not null default 0
);

insert into public.document_sequences (doc_type, last_number) values
  ('customer', 0),
  ('sales_order', 0),
  ('invoice', 0),
  ('atw_dr', 0),
  ('withdrawal_slip', 0);

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

  return p_prefix || to_char(now(), 'YYYY') || '-' || lpad(next_n::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Customers & items
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  city text,
  payment_terms text not null default 'COD',
  credit_limit numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create table public.items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  unit text not null default 'PCS',
  unit_price numeric(14, 2) not null default 0,
  cost numeric(14, 2) not null default 0,
  stock_qty numeric(14, 2) not null default 0,
  reorder_level numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sales orders
-- ---------------------------------------------------------------------------

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  so_number text not null unique,
  customer_id uuid not null references public.customers (id) on delete restrict,
  order_date date not null default current_date,
  delivery_date date,
  status public.so_status not null default 'draft',
  notes text,
  subtotal numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sales_orders_set_updated_at
before update on public.sales_orders
for each row execute function public.set_updated_at();

create table public.sales_order_lines (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  quantity numeric(14, 2) not null check (quantity > 0),
  unit_price numeric(14, 2) not null default 0,
  line_total numeric(14, 2) not null default 0,
  invoiced_qty numeric(14, 2) not null default 0 check (invoiced_qty >= 0),
  sort_order integer not null default 0
);

create index sales_orders_customer_idx on public.sales_orders (customer_id);
create index sales_order_lines_so_idx on public.sales_order_lines (sales_order_id);

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  sales_order_id uuid references public.sales_orders (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  invoice_date date not null default current_date,
  due_date date,
  status public.invoice_status not null default 'draft',
  subtotal numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  amount_paid numeric(14, 2) not null default 0,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  sales_order_line_id uuid references public.sales_order_lines (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  quantity numeric(14, 2) not null check (quantity > 0),
  unit_price numeric(14, 2) not null default 0,
  line_total numeric(14, 2) not null default 0,
  atw_qty numeric(14, 2) not null default 0 check (atw_qty >= 0),
  sort_order integer not null default 0
);

create index invoices_customer_idx on public.invoices (customer_id);
create index invoices_so_idx on public.invoices (sales_order_id);
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id);

-- ---------------------------------------------------------------------------
-- ATW / DR
-- ---------------------------------------------------------------------------

create table public.atw_dr (
  id uuid primary key default gen_random_uuid(),
  atw_number text not null unique,
  invoice_id uuid references public.invoices (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  issue_date date not null default current_date,
  status public.atw_status not null default 'draft',
  warehouse_notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger atw_dr_set_updated_at
before update on public.atw_dr
for each row execute function public.set_updated_at();

create table public.atw_dr_lines (
  id uuid primary key default gen_random_uuid(),
  atw_dr_id uuid not null references public.atw_dr (id) on delete cascade,
  invoice_line_id uuid references public.invoice_lines (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  quantity numeric(14, 2) not null check (quantity > 0),
  withdrawn_qty numeric(14, 2) not null default 0 check (withdrawn_qty >= 0),
  sort_order integer not null default 0
);

create index atw_dr_invoice_idx on public.atw_dr (invoice_id);
create index atw_dr_lines_header_idx on public.atw_dr_lines (atw_dr_id);

-- ---------------------------------------------------------------------------
-- Withdrawal slips
-- ---------------------------------------------------------------------------

create table public.withdrawal_slips (
  id uuid primary key default gen_random_uuid(),
  ws_number text not null unique,
  atw_dr_id uuid not null references public.atw_dr (id) on delete restrict,
  issue_date date not null default current_date,
  status public.ws_status not null default 'draft',
  issued_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger withdrawal_slips_set_updated_at
before update on public.withdrawal_slips
for each row execute function public.set_updated_at();

create table public.withdrawal_slip_lines (
  id uuid primary key default gen_random_uuid(),
  withdrawal_slip_id uuid not null references public.withdrawal_slips (id) on delete cascade,
  atw_dr_line_id uuid references public.atw_dr_lines (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  quantity numeric(14, 2) not null check (quantity > 0),
  sort_order integer not null default 0
);

create index withdrawal_slips_atw_idx on public.withdrawal_slips (atw_dr_id);
create index withdrawal_slip_lines_header_idx on public.withdrawal_slip_lines (withdrawal_slip_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.document_sequences enable row level security;
alter table public.customers enable row level security;
alter table public.items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_lines enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.atw_dr enable row level security;
alter table public.atw_dr_lines enable row level security;
alter table public.withdrawal_slips enable row level security;
alter table public.withdrawal_slip_lines enable row level security;

-- Profiles
create policy profiles_select_active on public.profiles
for select using (public.is_active_user());

create policy profiles_update_self on public.profiles
for update using (auth.uid() = id and public.is_active_user())
with check (
  auth.uid() = id
  and role = (select p.role from public.profiles p where p.id = auth.uid())
  and is_active = (select p.is_active from public.profiles p where p.id = auth.uid())
);

create policy profiles_admin_all on public.profiles
for all using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

-- Sequences: read for active users; increment via security definer function
create policy document_sequences_select on public.document_sequences
for select using (public.is_active_user());

-- Customers
create policy customers_select on public.customers
for select using (public.is_active_user());

create policy customers_write_sales on public.customers
for all using (public.current_profile_role() in ('admin', 'sales', 'accounting'))
with check (public.current_profile_role() in ('admin', 'sales', 'accounting'));

-- Items
create policy items_select on public.items
for select using (public.is_active_user());

create policy items_write_ops on public.items
for all using (public.current_profile_role() in ('admin', 'sales', 'warehouse'))
with check (public.current_profile_role() in ('admin', 'sales', 'warehouse'));

-- Sales orders
create policy sales_orders_select on public.sales_orders
for select using (public.is_active_user());

create policy sales_orders_write on public.sales_orders
for all using (public.current_profile_role() in ('admin', 'sales'))
with check (public.current_profile_role() in ('admin', 'sales'));

create policy sales_order_lines_select on public.sales_order_lines
for select using (public.is_active_user());

create policy sales_order_lines_write on public.sales_order_lines
for all using (public.current_profile_role() in ('admin', 'sales'))
with check (public.current_profile_role() in ('admin', 'sales'));

-- Invoices
create policy invoices_select on public.invoices
for select using (public.is_active_user());

create policy invoices_write on public.invoices
for all using (public.current_profile_role() in ('admin', 'accounting'))
with check (public.current_profile_role() in ('admin', 'accounting'));

create policy invoice_lines_select on public.invoice_lines
for select using (public.is_active_user());

create policy invoice_lines_write on public.invoice_lines
for all using (public.current_profile_role() in ('admin', 'accounting'))
with check (public.current_profile_role() in ('admin', 'accounting'));

-- ATW / DR
create policy atw_dr_select on public.atw_dr
for select using (public.is_active_user());

create policy atw_dr_write on public.atw_dr
for all using (public.current_profile_role() in ('admin', 'warehouse'))
with check (public.current_profile_role() in ('admin', 'warehouse'));

create policy atw_dr_lines_select on public.atw_dr_lines
for select using (public.is_active_user());

create policy atw_dr_lines_write on public.atw_dr_lines
for all using (public.current_profile_role() in ('admin', 'warehouse'))
with check (public.current_profile_role() in ('admin', 'warehouse'));

-- Withdrawal slips
create policy withdrawal_slips_select on public.withdrawal_slips
for select using (public.is_active_user());

create policy withdrawal_slips_write on public.withdrawal_slips
for all using (public.current_profile_role() in ('admin', 'warehouse'))
with check (public.current_profile_role() in ('admin', 'warehouse'));

create policy withdrawal_slip_lines_select on public.withdrawal_slip_lines
for select using (public.is_active_user());

create policy withdrawal_slip_lines_write on public.withdrawal_slip_lines
for all using (public.current_profile_role() in ('admin', 'warehouse'))
with check (public.current_profile_role() in ('admin', 'warehouse'));

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.next_doc_number(text, text) to authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
