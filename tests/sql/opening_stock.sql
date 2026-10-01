-- Opening stock for catalog items so existing SO-open tests have available quantity.
-- Uses the seeded admin. Apply after seed.sql.

do $$
declare
  admin_id uuid;
  adj uuid;
  item record;
begin
  select id into admin_id from public.users where role = 'admin' and status = 'active' limit 1;
  if admin_id is null then
    raise exception 'Opening stock seed requires an active admin user';
  end if;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);

  for item in select id from public.items
  loop
    adj := public.create_inventory_adjustment(jsonb_build_object(
      'remarks', 'Test opening stock',
      'lines', jsonb_build_array(jsonb_build_object(
        'item_id', item.id,
        'quantity', 10000,
        'direction', 'increase'
      ))
    ));
    perform public.post_inventory_adjustment(adj, 'Test opening stock');
  end loop;
end
$$;
