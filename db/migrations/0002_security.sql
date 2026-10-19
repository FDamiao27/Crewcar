-- CREW CAR — segurança ao nível da base de dados
--
-- O showroom público executa as suas consultas com a role restrita "crewcar_web"
-- (SET LOCAL ROLE dentro de uma transação). Esta role:
--   • só consegue ler colunas públicas (nunca VIN, preço de aquisição ou notas internas);
--   • só vê viaturas publicadas e não arquivadas (Row Level Security);
--   • só pode INSERIR pedidos de contacto, nunca os ler;
--   • não tem acesso a utilizadores, sessões, registos de atividade ou rascunhos.
-- Em Supabase, o RLS ativo sem políticas para "anon"/"authenticated" impede também
-- o acesso direto às tabelas através da API REST pública.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'crewcar_web') then
    create role crewcar_web nologin;
  end if;
end
$$;

grant crewcar_web to current_user;
grant usage on schema public to crewcar_web;
grant execute on function f_norm(text) to crewcar_web;

-- Ativar RLS em todas as tabelas da aplicação
alter table admin_users enable row level security;
alter table admin_sessions enable row level security;
alter table activity_log enable row level security;
alter table rate_limits enable row level security;
alter table vehicles enable row level security;
alter table vehicle_photos enable row level security;
alter table vehicle_equipment enable row level security;
alter table vehicle_links enable row level security;
alter table price_history enable row level security;
alter table promotions enable row level security;
alter table leads enable row level security;
alter table lead_activity enable row level security;
alter table site_content enable row level security;
alter table pages enable row level security;

-- Viaturas: apenas colunas públicas e apenas viaturas publicadas e não arquivadas
grant select (
  id, slug, reference, brand, model, version, category, registration_year, first_registration_date,
  mileage_km, fuel, transmission, engine_cc, power_hp, exterior_color, interior_color, doors, seats,
  condition, price_cents, short_description, description, warranty_info, warranty_verified,
  commercial_info, video_url, status, is_published, is_featured, is_demo, seo_title, seo_description,
  published_at, sold_at, archived_at, created_at, updated_at
) on vehicles to crewcar_web;
create policy vehicles_public_read on vehicles for select to crewcar_web
  using (is_published and archived_at is null);

grant select (id, vehicle_id, storage_key, width, height, variants, position, is_primary, alt_text, caption)
  on vehicle_photos to crewcar_web;
create policy vehicle_photos_public_read on vehicle_photos for select to crewcar_web
  using (exists (select 1 from vehicles v where v.id = vehicle_id));

grant select (id, vehicle_id, kind, label, position) on vehicle_equipment to crewcar_web;
create policy vehicle_equipment_public_read on vehicle_equipment for select to crewcar_web
  using (exists (select 1 from vehicles v where v.id = vehicle_id));

grant select (id, vehicle_id, kind, label, url, is_public, position) on vehicle_links to crewcar_web;
create policy vehicle_links_public_read on vehicle_links for select to crewcar_web
  using (is_public and exists (select 1 from vehicles v where v.id = vehicle_id));

-- O histórico de preços públicos é necessário para calcular o preço de referência
-- legal (menor preço praticado nos 30 dias anteriores a uma redução).
grant select (vehicle_id, price_cents, created_at) on price_history to crewcar_web;
create policy price_history_public_read on price_history for select to crewcar_web
  using (exists (select 1 from vehicles v where v.id = vehicle_id));

grant select (id, vehicle_id, discount_type, amount_cents, percent_bp, label, starts_at, ends_at, cancelled_at)
  on promotions to crewcar_web;
create policy promotions_public_read on promotions for select to crewcar_web
  using (cancelled_at is null and exists (select 1 from vehicles v where v.id = vehicle_id));

-- Conteúdos: apenas a versão publicada (nunca rascunhos)
grant select (key, published) on site_content to crewcar_web;
create policy site_content_public_read on site_content for select to crewcar_web using (true);

grant select (slug, title, body, is_published, seo_title, seo_description, updated_at) on pages to crewcar_web;
create policy pages_public_read on pages for select to crewcar_web using (is_published);

-- Pedidos de contacto: inserção apenas, sem leitura
grant insert (name, email, phone, vehicle_id, vehicle_label, subject, message, source, referrer, consent_at)
  on leads to crewcar_web;
create policy leads_public_insert on leads for insert to crewcar_web
  with check (status = 'novo');

-- Supabase: remover privilégios por omissão das roles da API REST, se existirem.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
    end if;
  end loop;
end
$$;
