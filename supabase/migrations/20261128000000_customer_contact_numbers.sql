-- Repeatable customer contact numbers. Existing contact_number values are copied once.
-- customers.contact_number remains the first number so older screens keep working.

create table if not exists public.customer_contact_numbers (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  contact_number text not null check (char_length(btrim(contact_number)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists customer_contact_numbers_customer_idx
  on public.customer_contact_numbers (customer_id, sort_order);

insert into public.customer_contact_numbers (customer_id, contact_number, sort_order)
select c.id, btrim(c.contact_number), 0
from public.customers c
where c.contact_number is not null
  and btrim(c.contact_number) <> ''
  and not exists (
    select 1 from public.customer_contact_numbers existing
    where existing.customer_id = c.id
  );

alter table public.customer_contact_numbers enable row level security;

drop policy if exists customer_contact_numbers_select on public.customer_contact_numbers;
create policy customer_contact_numbers_select on public.customer_contact_numbers
  for select using (public.is_active_user());

drop policy if exists customer_contact_numbers_write on public.customer_contact_numbers;
create policy customer_contact_numbers_write on public.customer_contact_numbers
  for all using (public.current_user_role() in ('admin', 'sales'))
  with check (public.current_user_role() in ('admin', 'sales'));

grant select, insert, update, delete on public.customer_contact_numbers to authenticated;
