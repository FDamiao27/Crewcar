-- CREW CAR — acesso público direto (showroom estático no GitHub Pages)
--
-- O showroom estático lê os dados diretamente da API do Supabase com a chave pública
-- ("anon"/publishable). A role "anon" recebe exatamente as mesmas permissões da role
-- restrita "crewcar_web": só colunas e linhas públicas, e apenas inserção de contactos.
-- Os dados privados (VIN, preço de aquisição, notas internas, contactos, utilizadores,
-- rascunhos) continuam inacessíveis — garantido pela base de dados, não pelo site.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant crewcar_web to anon';
    -- Tabelas futuras não ficam expostas por omissão à API pública
    execute 'alter default privileges in schema public revoke all on tables from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on functions from anon, authenticated';
  end if;
end
$$;

-- Proteção anti-spam dos pedidos de contacto ao nível da base de dados
-- (aplica-se tanto ao site Next.js como ao envio direto pela API pública).
alter table leads add column if not exists ip_hash text;
create index if not exists leads_ip_hash_idx on leads (ip_hash, created_at) where ip_hash is not null;

create or replace function leads_guard() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  ip text := '';
  recent integer;
  v record;
begin
  -- IP do pedido (disponível quando o pedido chega pela API do Supabase)
  begin
    ip := btrim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1));
  exception when others then
    ip := '';
  end;
  if ip <> '' then
    new.ip_hash := md5('crewcar:' || ip);
    select count(*) into recent from leads where ip_hash = new.ip_hash and created_at > now() - interval '10 minutes';
    if recent >= 5 then
      raise exception 'Recebemos demasiados pedidos a partir da sua ligação. Tente novamente dentro de alguns minutos.' using errcode = 'P0001';
    end if;
  else
    new.ip_hash := null;
  end if;

  select count(*) into recent from leads where created_at > now() - interval '10 minutes';
  if recent >= 60 then
    raise exception 'Serviço temporariamente indisponível. Tente novamente mais tarde.' using errcode = 'P0001';
  end if;

  if (select count(*) from regexp_matches(new.message, 'https?://', 'gi')) > 2 then
    raise exception 'A mensagem contém demasiadas ligações.' using errcode = 'P0001';
  end if;
  if new.consent_at is null then
    raise exception 'É necessário aceitar o tratamento dos dados.' using errcode = 'P0001';
  end if;

  -- Valores controlados pelo servidor, nunca pelo pedido
  new.status := 'novo';
  new.consent_at := now();
  new.created_at := now();
  new.source := case when new.source in ('pagina_contactos', 'pagina_viatura', 'pagina_inicial') then new.source else 'website' end;
  if new.vehicle_id is not null then
    select id, brand, model, version, reference into v
    from vehicles where id = new.vehicle_id and is_published and archived_at is null;
    if found then
      new.vehicle_label := left(v.brand || ' ' || v.model || coalesce(' ' || v.version, '') || ' (' || v.reference || ')', 200);
    else
      new.vehicle_id := null;
      new.vehicle_label := null;
    end if;
  else
    new.vehicle_label := null;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_guard on leads;
create trigger leads_guard before insert on leads for each row execute function leads_guard();
revoke execute on function leads_guard() from public;

-- Fotografias e imagens do site: bucket do Supabase Storage com leitura pública
-- (os nomes dos ficheiros são aleatórios; a listagem do bucket não é permitida).
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    execute $sql$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('crewcar', 'crewcar', true, 16777216, array['image/webp', 'image/png', 'image/jpeg', 'image/x-icon'])
      on conflict (id) do update set public = true
    $sql$;
  end if;
end
$$;
