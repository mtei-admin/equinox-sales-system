-- Master-data audit on users (Phase 3). Customers and items already have created_by/updated_by.

alter table public.users
  add column if not exists created_by uuid references public.users (id) on delete set null,
  add column if not exists updated_by uuid references public.users (id) on delete set null;

create index if not exists users_created_by_idx on public.users (created_by);
create index if not exists users_updated_by_idx on public.users (updated_by);

comment on column public.users.created_by is 'Admin who invited the user, when known. Null for the first Auth signup.';
comment on column public.users.updated_by is 'Last admin or self who updated the profile.';
