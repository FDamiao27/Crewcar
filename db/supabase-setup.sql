-- CREW CAR — instalação completa para Supabase (gerado por scripts/build-supabase-sql.ts)
-- Cole este ficheiro inteiro no Supabase: SQL Editor → New query → Run.
-- Pode ser executado numa base de dados vazia. Não cria viaturas nem utilizadores.

begin;

create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
alter table schema_migrations enable row level security;

-- ───────────── 0001_schema.sql ─────────────
-- CREW CAR — esquema inicial
-- Compatível com PostgreSQL 14+ (local, Supabase, Neon, RDS).

create extension if not exists btree_gist;

-- ───────────────────────────── Funções utilitárias ─────────────────────────────

-- Normalização para pesquisa sem acentos (sem depender da extensão unaccent).
create or replace function f_norm(t text) returns text
language sql immutable parallel safe as $$
  select translate(lower(coalesce(t, '')),
    'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
    'aaaaaaeeeeiiiiooooouuuucnyy')
$$;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────────────────────── Administração ─────────────────────────────

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) between 3 and 254 and email = lower(email)),
  name text not null check (length(name) between 1 and 120),
  password_hash text not null,
  role text not null default 'editor' check (role in ('owner', 'admin', 'editor')),
  is_active boolean not null default true,
  failed_login_count integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index admin_users_email_key on admin_users (email);
create trigger admin_users_updated_at before update on admin_users
  for each row execute function set_updated_at();

create table admin_sessions (
  token_hash text primary key,
  user_id uuid not null references admin_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip text,
  user_agent text
);
create index admin_sessions_user_idx on admin_sessions (user_id);
create index admin_sessions_expires_idx on admin_sessions (expires_at);

create table activity_log (
  id bigserial primary key,
  actor_id uuid references admin_users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on activity_log (created_at desc);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

-- ───────────────────────────── Viaturas ─────────────────────────────

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 140),
  reference text not null check (length(reference) between 1 and 40),

  brand text not null check (length(brand) between 1 and 60),
  model text not null check (length(model) between 1 and 80),
  version text check (version is null or length(version) <= 120),
  category text check (category in (
    'citadino', 'utilitario', 'berlina', 'carrinha', 'suv', 'coupe', 'cabrio',
    'monovolume', 'comercial', 'pickup', 'desportivo', 'classico', 'outro')),
  registration_year integer check (registration_year between 1900 and 2100),
  first_registration_date date,
  mileage_km integer check (mileage_km between 0 and 5000000),
  fuel text check (fuel in (
    'gasolina', 'gasoleo', 'hibrido', 'hibrido_plugin', 'eletrico', 'gpl', 'gnv', 'hidrogenio', 'outro')),
  transmission text check (transmission in ('manual', 'automatica', 'semiautomatica')),
  engine_cc integer check (engine_cc between 1 and 20000),
  power_hp integer check (power_hp between 1 and 3000),
  exterior_color text check (exterior_color is null or length(exterior_color) <= 60),
  interior_color text check (interior_color is null or length(interior_color) <= 60),
  doors smallint check (doors between 1 and 9),
  seats smallint check (seats between 1 and 60),
  condition text check (condition in ('novo', 'seminovo', 'usado', 'servico', 'classico')),
  vin text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),

  -- Preços em cêntimos de euro
  purchase_price_cents integer check (purchase_price_cents >= 0),
  price_cents integer check (price_cents >= 0),

  short_description text check (short_description is null or length(short_description) <= 300),
  description text check (description is null or length(description) <= 20000),
  warranty_info text check (warranty_info is null or length(warranty_info) <= 2000),
  warranty_verified boolean not null default false,
  commercial_info text check (commercial_info is null or length(commercial_info) <= 2000),
  internal_notes text check (internal_notes is null or length(internal_notes) <= 10000),
  video_url text check (video_url is null or video_url ~* '^https?://'),

  status text not null default 'disponivel' check (status in ('disponivel', 'reservado', 'vendido')),
  is_published boolean not null default false,
  is_featured boolean not null default false,
  is_demo boolean not null default false,
  seo_title text check (seo_title is null or length(seo_title) <= 120),
  seo_description text check (seo_description is null or length(seo_description) <= 300),

  published_at timestamptz,
  reserved_at timestamptz,
  sold_at timestamptz,
  archived_at timestamptz,
  created_by uuid references admin_users (id) on delete set null,
  updated_by uuid references admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vehicles_published_requires_price
    check (not is_published or (price_cents is not null and price_cents > 0))
);
create unique index vehicles_slug_key on vehicles (slug);
create unique index vehicles_reference_key on vehicles (lower(reference));
create unique index vehicles_vin_key on vehicles (vin) where vin is not null;
create index vehicles_public_idx on vehicles (is_published, status) where archived_at is null;
create index vehicles_brand_model_idx on vehicles (lower(brand), lower(model));
create index vehicles_price_idx on vehicles (price_cents);
create index vehicles_featured_idx on vehicles (is_featured) where is_featured;
create index vehicles_created_idx on vehicles (created_at desc);
create trigger vehicles_updated_at before update on vehicles
  for each row execute function set_updated_at();

create table vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  storage_key text not null unique,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  bytes integer not null check (bytes > 0),
  variants integer[] not null,
  position integer not null default 0,
  is_primary boolean not null default false,
  alt_text text check (alt_text is null or length(alt_text) <= 200),
  caption text check (caption is null or length(caption) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index vehicle_photos_primary_key on vehicle_photos (vehicle_id) where is_primary;
create index vehicle_photos_vehicle_idx on vehicle_photos (vehicle_id, position);
create trigger vehicle_photos_updated_at before update on vehicle_photos
  for each row execute function set_updated_at();

create table vehicle_equipment (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  kind text not null check (kind in ('equipamento', 'extra')),
  label text not null check (length(label) between 1 and 150),
  position integer not null default 0
);
create index vehicle_equipment_vehicle_idx on vehicle_equipment (vehicle_id, kind, position);

create table vehicle_links (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  kind text not null check (kind in ('portal', 'video', 'historico', 'outro')),
  label text check (label is null or length(label) <= 120),
  url text not null check (url ~* '^https?://' and length(url) <= 2000),
  is_public boolean not null default false,
  position integer not null default 0
);
create index vehicle_links_vehicle_idx on vehicle_links (vehicle_id, position);

-- Histórico do preço de venda (alimentado automaticamente por trigger).
create table price_history (
  id bigserial primary key,
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  price_cents integer not null check (price_cents >= 0),
  previous_price_cents integer,
  changed_by uuid references admin_users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index price_history_vehicle_idx on price_history (vehicle_id, created_at);

create or replace function track_price_change() returns trigger
language plpgsql as $$
begin
  if new.price_cents is not null and (tg_op = 'INSERT' or new.price_cents is distinct from old.price_cents) then
    insert into price_history (vehicle_id, price_cents, previous_price_cents, changed_by)
    values (new.id, new.price_cents, case when tg_op = 'UPDATE' then old.price_cents end, new.updated_by);
  end if;
  return new;
end;
$$;
create trigger vehicles_price_history after insert or update of price_cents on vehicles
  for each row execute function track_price_change();

-- Promoções: no máximo uma promoção ativa por viatura em qualquer instante
-- (impede a aplicação duplicada de descontos ao nível da base de dados).
create table promotions (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  discount_type text not null check (discount_type in ('valor', 'percentagem', 'preco_final')),
  amount_cents integer check (amount_cents >= 0),
  percent_bp integer check (percent_bp between 1 and 9000),
  label text check (label is null or length(label) <= 80),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint promotions_value_matches_type check (
    (discount_type = 'percentagem' and percent_bp is not null and amount_cents is null)
    or (discount_type <> 'percentagem' and amount_cents is not null and percent_bp is null)
  ),
  constraint promotions_dates check (ends_at is null or ends_at > starts_at),
  constraint promotions_no_overlap exclude using gist (
    vehicle_id with =,
    tstzrange(starts_at, coalesce(ends_at, 'infinity'::timestamptz), '[)') with &&
  ) where (cancelled_at is null)
);
create index promotions_vehicle_idx on promotions (vehicle_id, starts_at);

-- ───────────────────────────── Contactos (CRM) ─────────────────────────────

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  email text check (email is null or (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text check (phone is null or length(phone) between 6 and 30),
  vehicle_id uuid references vehicles (id) on delete set null,
  vehicle_label text check (vehicle_label is null or length(vehicle_label) <= 200),
  subject text check (subject is null or length(subject) <= 150),
  message text not null check (length(message) between 1 and 5000),
  source text check (source is null or length(source) <= 60),
  referrer text check (referrer is null or length(referrer) <= 500),
  status text not null default 'novo'
    check (status in ('novo', 'em_contacto', 'em_negociacao', 'convertido', 'perdido')),
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_contact_required check (email is not null or phone is not null)
);
create index leads_status_idx on leads (status, created_at desc);
create index leads_created_idx on leads (created_at desc);
create index leads_vehicle_idx on leads (vehicle_id);
create trigger leads_updated_at before update on leads
  for each row execute function set_updated_at();

create table lead_activity (
  id bigserial primary key,
  lead_id uuid not null references leads (id) on delete cascade,
  kind text not null check (kind in ('criado', 'estado', 'nota')),
  from_status text,
  to_status text,
  body text check (body is null or length(body) <= 5000),
  actor_id uuid references admin_users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index lead_activity_lead_idx on lead_activity (lead_id, created_at);

create or replace function log_lead_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into lead_activity (lead_id, kind, to_status) values (new.id, 'criado', new.status);
  return new;
end;
$$;
create trigger leads_created_activity after insert on leads
  for each row execute function log_lead_created();

-- ───────────────────────────── Conteúdos e definições ─────────────────────────────

-- Documentos JSON com rascunho e versão publicada (pré-visualização antes de publicar).
create table site_content (
  key text primary key check (key in ('settings', 'content')),
  draft jsonb not null default '{}'::jsonb,
  published jsonb not null default '{}'::jsonb,
  updated_by uuid references admin_users (id) on delete set null,
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table pages (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(title) between 1 and 150),
  body text not null default '' check (length(body) <= 100000),
  is_published boolean not null default false,
  seo_title text check (seo_title is null or length(seo_title) <= 120),
  seo_description text check (seo_description is null or length(seo_description) <= 300),
  updated_by uuid references admin_users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger pages_updated_at before update on pages
  for each row execute function set_updated_at();

insert into schema_migrations (name) values ('0001_schema.sql') on conflict do nothing;

-- ───────────── 0002_security.sql ─────────────
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

insert into schema_migrations (name) values ('0002_security.sql') on conflict do nothing;

-- ───────────── 0003_hardening.sql ─────────────
-- CREW CAR — reforço de segurança (recomendações do Security Advisor do Supabase)

-- search_path fixo nas funções (evita resolução de objetos noutros esquemas)
alter function f_norm(text) set search_path = pg_catalog, public;
alter function set_updated_at() set search_path = pg_catalog, public;
alter function track_price_change() set search_path = pg_catalog, public;

-- A função do trigger de contactos não deve ser invocável diretamente (ex.: API REST /rpc).
-- Os triggers continuam a executá-la normalmente.
revoke execute on function log_lead_created() from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function log_lead_created() from %I', r);
    end if;
  end loop;
end
$$;

insert into schema_migrations (name) values ('0003_hardening.sql') on conflict do nothing;

-- ───────────── Dados iniciais ─────────────
insert into site_content (key, draft, published, published_at) values
  ('settings', $json${"brandName":"CREW CAR","tagline":"","logo":null,"favicon":null,"appearance":{"colors":{"ink":"#0B0B0C","ink2":"#111214","graphite":"#202124","metal":"#A3A5A8","soft":"#F4F4F2","white":"#FFFFFF"},"font":"inter"},"contact":{"phone":"","phoneNote":"","email":"","whatsapp":"","address":{"street":"","postalCode":"","city":"","country":"Portugal"},"mapUrl":"","openingHours":""},"social":{"facebook":"","instagram":"","youtube":"","tiktok":"","linkedin":""},"company":{"legalName":"","nif":"","registeredOffice":"","licence":"","complaintsBook":true},"regional":{"currency":"EUR","language":"pt-PT","timezone":"Europe/Lisbon","dateFormat":"DD/MM/AAAA"},"cookies":{"bannerEnabled":true,"message":"Utilizamos cookies essenciais para o funcionamento do site. Com a sua autorização, utilizamos também cookies de análise para melhorar a experiência."},"analytics":{"provider":"none","plausibleDomain":"","ga4Id":""},"publishing":{"perPage":12,"showReserved":true,"keepSoldPages":true,"similarCount":4,"whatsappMessage":"Olá! Tenho interesse nesta viatura:","allowIndexing":true}}$json$::jsonb, $json${"brandName":"CREW CAR","tagline":"","logo":null,"favicon":null,"appearance":{"colors":{"ink":"#0B0B0C","ink2":"#111214","graphite":"#202124","metal":"#A3A5A8","soft":"#F4F4F2","white":"#FFFFFF"},"font":"inter"},"contact":{"phone":"","phoneNote":"","email":"","whatsapp":"","address":{"street":"","postalCode":"","city":"","country":"Portugal"},"mapUrl":"","openingHours":""},"social":{"facebook":"","instagram":"","youtube":"","tiktok":"","linkedin":""},"company":{"legalName":"","nif":"","registeredOffice":"","licence":"","complaintsBook":true},"regional":{"currency":"EUR","language":"pt-PT","timezone":"Europe/Lisbon","dateFormat":"DD/MM/AAAA"},"cookies":{"bannerEnabled":true,"message":"Utilizamos cookies essenciais para o funcionamento do site. Com a sua autorização, utilizamos também cookies de análise para melhorar a experiência."},"analytics":{"provider":"none","plausibleDomain":"","ga4Id":""},"publishing":{"perPage":12,"showReserved":true,"keepSoldPages":true,"similarCount":4,"whatsappMessage":"Olá! Tenho interesse nesta viatura:","allowIndexing":true}}$json$::jsonb, now()),
  ('content', $json${"hero":{"eyebrow":"Stand automóvel","title":"ENCONTRA O TEU PRÓXIMO DESTINO.","subtitle":"Uma seleção de automóveis escolhidos ao detalhe. Descobre a tua próxima viatura com a Crew Car.","primaryCta":"Explorar viaturas","secondaryCta":"Falar com a Crew Car","image":null,"overlay":55},"home":{"featuredTitle":"Em destaque","featuredSubtitle":"Viaturas selecionadas pela equipa Crew Car.","latestTitle":"Chegadas recentes","latestSubtitle":"As últimas viaturas a entrar no nosso stock.","showLatest":true,"showAbout":true,"showAdvantages":true,"showFaq":true,"showContacts":true},"about":{"title":"O Stand","lead":"Uma seleção de automóveis escolhidos ao detalhe. Consulte o catálogo, compare as viaturas e fale connosco para saber mais.","body":""},"advantages":{"title":"Porquê a Crew Car","items":[]},"faq":{"title":"Perguntas frequentes","items":[]},"banners":[],"footer":{"text":""},"seo":{"title":"CREW CAR — Stand automóvel","description":"Uma seleção de automóveis escolhidos ao detalhe. Descobre a tua próxima viatura com a Crew Car.","ogImage":null}}$json$::jsonb, $json${"hero":{"eyebrow":"Stand automóvel","title":"ENCONTRA O TEU PRÓXIMO DESTINO.","subtitle":"Uma seleção de automóveis escolhidos ao detalhe. Descobre a tua próxima viatura com a Crew Car.","primaryCta":"Explorar viaturas","secondaryCta":"Falar com a Crew Car","image":null,"overlay":55},"home":{"featuredTitle":"Em destaque","featuredSubtitle":"Viaturas selecionadas pela equipa Crew Car.","latestTitle":"Chegadas recentes","latestSubtitle":"As últimas viaturas a entrar no nosso stock.","showLatest":true,"showAbout":true,"showAdvantages":true,"showFaq":true,"showContacts":true},"about":{"title":"O Stand","lead":"Uma seleção de automóveis escolhidos ao detalhe. Consulte o catálogo, compare as viaturas e fale connosco para saber mais.","body":""},"advantages":{"title":"Porquê a Crew Car","items":[]},"faq":{"title":"Perguntas frequentes","items":[]},"banners":[],"footer":{"text":""},"seo":{"title":"CREW CAR — Stand automóvel","description":"Uma seleção de automóveis escolhidos ao detalhe. Descobre a tua próxima viatura com a Crew Car.","ogImage":null}}$json$::jsonb, now())
on conflict (key) do nothing;
insert into pages (slug, title, body, is_published) values ('privacidade', $crewcar$Política de privacidade$crewcar$, $crewcar$## Responsável pelo tratamento

[Denominação social], com o NIF [número] e sede em [morada], é a entidade responsável pelo tratamento dos dados pessoais recolhidos através deste website.

Contacto para questões de privacidade: [e-mail].

## Dados que recolhemos

Quando utiliza o formulário de contacto, recolhemos os dados que nos fornece: nome, endereço de e-mail, número de telefone, a viatura em que tem interesse e o conteúdo da mensagem.

## Finalidades e fundamento

Utilizamos estes dados para responder ao seu pedido e, quando solicitado, para preparar uma proposta relativa a uma viatura. [Indicar o fundamento de licitude aplicável, por exemplo: diligências pré-contratuais a pedido do titular ou consentimento.]

## Conservação

Os dados são conservados durante [prazo] após o último contacto, sendo depois eliminados, salvo obrigação legal de conservação.

## Partilha de dados

[Indicar as categorias de subcontratantes — por exemplo, alojamento do website e da base de dados — e a localização dos servidores.]

## Os seus direitos

Pode, a qualquer momento, solicitar o acesso, a retificação, o apagamento, a limitação do tratamento, a portabilidade dos seus dados ou opor-se ao tratamento, através do contacto indicado acima. Tem também o direito de apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD).

## Atualizações

Última atualização: [data].$crewcar$, false) on conflict (slug) do nothing;
insert into pages (slug, title, body, is_published) values ('cookies', $crewcar$Política de cookies$crewcar$, $crewcar$## O que são cookies

Cookies são pequenos ficheiros de texto guardados no seu dispositivo quando visita um website.

## Cookies que utilizamos

**Essenciais (sempre ativos)**

- *cc_consent* — guarda a sua escolha relativamente a cookies (180 dias).

**Análise (apenas com o seu consentimento)**

- [Indicar a ferramenta de análise utilizada, os cookies que define e a respetiva duração — ou remover esta secção se não for utilizada nenhuma.]

## Gerir as suas preferências

Pode alterar a sua escolha a qualquer momento através da ligação "Preferências de cookies", no rodapé do website, ou eliminando os cookies nas definições do seu navegador.

Última atualização: [data].$crewcar$, false) on conflict (slug) do nothing;
insert into pages (slug, title, body, is_published) values ('informacao-legal', $crewcar$Informação legal$crewcar$, $crewcar$## Identificação da empresa

- Denominação social: [denominação]
- NIF: [número]
- Sede: [morada]
- Registo / licença de atividade: [se aplicável]

## Preços e informação das viaturas

Os preços apresentados incluem [indicar se incluem IVA, despesas de legalização e outros encargos]. As características das viaturas são as indicadas pelo stand e podem ser confirmadas presencialmente.

Quando é anunciada uma redução de preço, o preço anterior indicado corresponde ao preço mais baixo praticado nos 30 dias anteriores à redução.

## Livro de Reclamações

Dispomos de Livro de Reclamações em formato físico e eletrónico, disponível em www.livroreclamacoes.pt.

## Resolução alternativa de litígios

Em caso de litígio, o consumidor pode recorrer a uma entidade de resolução alternativa de litígios de consumo: [indicar a entidade competente e o respetivo website]. Mais informações no Portal do Consumidor (www.consumidor.gov.pt).$crewcar$, false) on conflict (slug) do nothing;

commit;

-- ───────────── Primeiro administrador (opcional) ─────────────
-- Prefira: DATABASE_URL="…" npm run admin:create -- --email o.seu@email.pt --name "O seu nome"
-- Em alternativa, substitua os valores abaixo, remova os "--" e execute (pgcrypto gera um hash bcrypt):
-- insert into admin_users (email, name, password_hash, role)
-- values ('o.seu@email.pt', 'O seu nome', extensions.crypt('PalavraPasseForte123', extensions.gen_salt('bf', 12)), 'owner');
