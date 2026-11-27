-- Move every Main warehouse assignment onto DAVAO, then rename DAVAO.
-- The Main row stays so existing identifiers remain valid, and it is inactive
-- so new stock, receipts, and slips cannot select it.
-- Movements move with the receiving reports, adjustments, and withdrawal slips
-- that posted them, so a later reversal uses the same warehouse.

do $$
declare
  main_id uuid := '11111111-1111-4111-8111-111111111111';
  davao_id uuid;
  target record;
begin
  select id into davao_id
  from public.warehouses
  where name in ('DAVAO', 'DAVAO (MAIN)')
  order by case when name = 'DAVAO (MAIN)' then 0 else 1 end
  limit 1;

  if davao_id is null then
    raise exception 'DAVAO warehouse was not found';
  end if;
  if davao_id = main_id then
    raise exception 'DAVAO warehouse id matches Main';
  end if;

  for target in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'warehouse_id'
      and t.table_type = 'BASE TABLE'
  loop
    execute format(
      'update %I.%I set warehouse_id = $1 where warehouse_id = $2',
      target.table_schema,
      target.table_name
    ) using davao_id, main_id;
  end loop;

  update public.warehouses
  set name = 'DAVAO (MAIN)', status = 'active'
  where id = davao_id;

  update public.warehouses
  set status = 'inactive'
  where id = main_id;
end $$;

create or replace function public.default_warehouse_id()
returns uuid
language sql
stable
as $$
  select id from public.warehouses where name = 'DAVAO (MAIN)' limit 1;
$$;
