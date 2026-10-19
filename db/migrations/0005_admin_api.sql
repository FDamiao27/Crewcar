-- CREW CAR — back office no navegador (GitHub Pages) com Supabase Auth
--
-- Os administradores iniciam sessão com o Supabase Auth. Um utilizador autenticado só tem
-- acesso de administração se o seu e-mail existir na tabela admin_users e estiver ativo.
-- Uma conta Supabase Auth sem registo em admin_users não tem acesso a nada.

alter table admin_users alter column password_hash set default '!';

-- Perfil do administrador da sessão atual (null se não for administrador)
create or replace function current_admin_role() returns text
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  claims jsonb;
  r text;
begin
  begin
    claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  exception when others then
    return null;
  end;
  select role into r from admin_users
  where email = lower(coalesce(claims ->> 'email', '')) and is_active
  limit 1;
  return r;
end;
$$;

create or replace function current_admin() returns table (id uuid, email text, name text, role text)
language sql stable security definer set search_path = pg_catalog, public as $$
  select u.id, u.email, u.name, u.role from admin_users u
  where u.email = lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', '')) and u.is_active
  limit 1
$$;

revoke execute on function current_admin_role() from public;
revoke execute on function current_admin() from public;

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    return;
  end if;

  execute 'grant execute on function current_admin_role() to authenticated';
  execute 'grant execute on function current_admin() to authenticated';
  execute 'grant usage on schema public to authenticated';
  execute 'grant execute on function f_norm(text) to authenticated';

  -- Tabelas geridas no back office: acesso total, mas apenas para administradores ativos
  foreach t in array array[
    'vehicles', 'vehicle_photos', 'vehicle_equipment', 'vehicle_links', 'price_history', 'promotions',
    'leads', 'lead_activity', 'site_content', 'pages', 'activity_log'
  ] loop
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('drop policy if exists %I on %I', t || '_admin_all', t);
    execute format(
      'create policy %I on %I for all to authenticated using (current_admin_role() is not null) with check (current_admin_role() is not null)',
      t || '_admin_all', t);
  end loop;
  execute 'grant usage, select on all sequences in schema public to authenticated';

  -- Utilizadores: leitura para administradores (sem o hash da palavra-passe);
  -- criação e alteração apenas pelo proprietário
  execute 'grant select (id, email, name, role, is_active, last_login_at, created_at, locked_until) on admin_users to authenticated';
  execute 'grant insert (email, name, role, is_active) on admin_users to authenticated';
  execute 'grant update (name, role, is_active) on admin_users to authenticated';
  execute 'drop policy if exists admin_users_admin_read on admin_users';
  execute 'create policy admin_users_admin_read on admin_users for select to authenticated using (current_admin_role() is not null)';
  execute 'drop policy if exists admin_users_owner_insert on admin_users';
  execute $p$create policy admin_users_owner_insert on admin_users for insert to authenticated with check (current_admin_role() = 'owner')$p$;
  execute 'drop policy if exists admin_users_owner_update on admin_users';
  execute $p$create policy admin_users_owner_update on admin_users for update to authenticated using (current_admin_role() = 'owner') with check (current_admin_role() = 'owner')$p$;

  -- Fotografias e imagens do site no Supabase Storage: escrita apenas por administradores
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    execute 'drop policy if exists crewcar_admin_select on storage.objects';
    execute $p$create policy crewcar_admin_select on storage.objects for select to authenticated using (bucket_id = 'crewcar' and public.current_admin_role() is not null)$p$;
    execute 'drop policy if exists crewcar_admin_insert on storage.objects';
    execute $p$create policy crewcar_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'crewcar' and public.current_admin_role() is not null)$p$;
    execute 'drop policy if exists crewcar_admin_update on storage.objects';
    execute $p$create policy crewcar_admin_update on storage.objects for update to authenticated using (bucket_id = 'crewcar' and public.current_admin_role() is not null)$p$;
    execute 'drop policy if exists crewcar_admin_delete on storage.objects';
    execute $p$create policy crewcar_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'crewcar' and public.current_admin_role() is not null)$p$;
  end if;
end
$$;
