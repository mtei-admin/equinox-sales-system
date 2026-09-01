-- Non-production seed. Auth passwords live in auth.users, not public.users.
-- Sign in with email admin@equinox.local and password Mteiadmin1.
-- Profile: username admin, full name JAYSON LORENO, role admin (full access).

create extension if not exists pgcrypto;

do $$
declare
  uid constant uuid := '00000000-0000-4000-a000-000000000001';
  admin_email constant text := 'admin@equinox.local';
  password_hash text;
  has_enc_password boolean;
  has_identities boolean;
  existing_id uuid;
  meta jsonb := '{"username":"admin","full_name":"JAYSON LORENO","role":"admin"}'::jsonb;
begin
  perform set_config('search_path', 'public, extensions, auth', true);

  begin
    password_hash := crypt('Mteiadmin1', gen_salt('bf', 10));
  exception
    when undefined_function then
      password_hash := extensions.crypt('Mteiadmin1', extensions.gen_salt('bf', 10));
  end;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'encrypted_password'
  ) into has_enc_password;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'identities'
  ) into has_identities;

  select u.id into existing_id
  from public.users u
  where u.username = 'admin'
  limit 1;

  if existing_id is null then
    select id into existing_id from auth.users where email = admin_email limit 1;
  end if;

  if existing_id is null then
    existing_id := uid;
    if has_enc_password then
      begin
        insert into auth.users (
          instance_id,
          id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at,
          confirmation_token,
          recovery_token,
          email_change_token_new,
          email_change
        ) values (
          '00000000-0000-0000-0000-000000000000',
          existing_id,
          'authenticated',
          'authenticated',
          admin_email,
          password_hash,
          now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          meta,
          now(),
          now(),
          '',
          '',
          '',
          ''
        );
      exception
        when others then
          insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
          values (existing_id, admin_email, password_hash, now(), meta);
      end;
    else
      insert into auth.users (id, email, raw_user_meta_data)
      values (existing_id, admin_email, meta);
    end if;
  elsif has_enc_password then
    update auth.users
    set
      email = admin_email,
      encrypted_password = password_hash,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || meta,
      updated_at = now()
    where id = existing_id;
  end if;

  -- Nested IF so the identities relation is not planned on the auth stub.
  if has_identities then
    if exists (
      select 1 from auth.identities where user_id = existing_id and provider = 'email'
    ) then
      null;
    else
    begin
      insert into auth.identities (
        provider_id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        existing_id::text,
        existing_id,
        jsonb_build_object('sub', existing_id::text, 'email', admin_email, 'email_verified', true),
        'email',
        now(),
        now(),
        now()
      );
    exception
      when others then
        begin
          insert into auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
          ) values (
            gen_random_uuid(),
            existing_id,
            jsonb_build_object('sub', existing_id::text, 'email', admin_email),
            'email',
            now(),
            now(),
            now()
          );
        exception
          when others then
            raise notice 'auth.identities seed skipped: %', sqlerrm;
        end;
    end;
    end if;
  end if;

  if exists (select 1 from public.users where id = existing_id) then
    -- Do not change role here: prevent_user_privilege_escalation requires an admin JWT.
    update public.users
    set
      username = 'admin',
      full_name = 'JAYSON LORENO',
      status = 'active'
    where id = existing_id;
  else
    insert into public.users (id, username, full_name, role, status)
    values (existing_id, 'admin', 'JAYSON LORENO', 'admin', 'active');
  end if;
end
$$;

insert into public.customers (name, billing_address, tin_number, contact_person, contact_number, status)
select v.name, v.billing_address, v.tin_number, v.contact_person, v.contact_number, v.status
from (
  values
    ('Northwind Trading', '123 Port Area, Manila', '000-111-222-000', 'Ana Reyes', '+63 2 8123 4567', 'active'::public.master_status),
    ('Horizon Builders', '88 EDSA, Quezon City', '000-333-444-000', 'Luis Tan', '+63 2 8765 4321', 'active'::public.master_status)
) as v(name, billing_address, tin_number, contact_person, contact_number, status)
where not exists (
  select 1 from public.customers c where c.name = v.name
);

insert into public.items (name, description, brand, model, barcode, status)
select v.name, v.description, v.brand, v.model, v.barcode, v.status
from (
  values
    ('Steel pipe 2in', 'Schedule 40 steel pipe', 'Equinox', 'SP-2', 'EQX-STEEL-001', 'active'::public.master_status),
    ('THHN wire 14mm', 'Copper building wire', 'Equinox', 'THHN-14', 'EQX-WIRE-014', 'active'::public.master_status)
) as v(name, description, brand, model, barcode, status)
where not exists (
  select 1 from public.items i where i.name = v.name
);
