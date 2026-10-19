import "server-only";
import { cache } from "react";
import { asPublic, type Tx } from "@/lib/db";
import type { Category, Fuel, Transmission, VehicleStatus, Condition, LinkKind } from "@/lib/constants";
import { computePricing, type Pricing, type PriceHistoryLike, type PromotionLike } from "@/lib/pricing";
import { parseContent, parseSettings, type Content, type Settings } from "@/lib/site-schema";

// ───────────────────────────── Tipos públicos ─────────────────────────────

export type PublicPhoto = {
  id: string;
  storageKey: string;
  width: number;
  height: number;
  variants: number[];
  position: number;
  isPrimary: boolean;
  altText: string | null;
  caption: string | null;
};

export type VehicleCard = {
  id: string;
  slug: string;
  reference: string;
  brand: string;
  model: string;
  version: string | null;
  category: Category | null;
  registrationYear: number | null;
  mileageKm: number | null;
  fuel: Fuel | null;
  transmission: Transmission | null;
  powerHp: number | null;
  status: VehicleStatus;
  isFeatured: boolean;
  isDemo: boolean;
  priceCents: number | null;
  publishedAt: Date | null;
  shortDescription: string | null;
  photo: PublicPhoto | null;
  pricing: Pricing;
};

export type VehicleDetail = VehicleCard & {
  firstRegistrationDate: string | null;
  engineCc: number | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  doors: number | null;
  seats: number | null;
  condition: Condition | null;
  description: string | null;
  warrantyInfo: string | null;
  warrantyVerified: boolean;
  commercialInfo: string | null;
  videoUrl: string | null;
  isPublished: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  soldAt: Date | null;
  updatedAt: Date;
  photos: PublicPhoto[];
  equipment: string[];
  extras: string[];
  links: { id: string; kind: LinkKind; label: string | null; url: string }[];
};

// Colunas que a role pública pode ler (devem coincidir com as permissões em 0002_security.sql).
export const PUBLIC_VEHICLE_COLUMNS = `
  v.id, v.slug, v.reference, v.brand, v.model, v.version, v.category, v.registration_year,
  v.first_registration_date, v.mileage_km, v.fuel, v.transmission, v.engine_cc, v.power_hp,
  v.exterior_color, v.interior_color, v.doors, v.seats, v.condition, v.price_cents,
  v.short_description, v.description, v.warranty_info, v.warranty_verified, v.commercial_info,
  v.video_url, v.status, v.is_published, v.is_featured, v.is_demo, v.seo_title, v.seo_description,
  v.published_at, v.sold_at, v.created_at, v.updated_at`;

export const ACTIVE_PROMO_JOIN = `
  left join lateral (
    select p.id, p.discount_type, p.amount_cents, p.percent_bp
    from promotions p
    where p.vehicle_id = v.id and p.cancelled_at is null
      and p.starts_at <= now() and (p.ends_at is null or p.ends_at > now())
    limit 1
  ) pr on true`;

// Preço atual em SQL (para filtros e ordenação). Igual a applyDiscount() em pricing.ts.
export const CURRENT_PRICE_SQL = `(case
  when pr.id is null then v.price_cents
  when pr.discount_type = 'valor' then greatest(v.price_cents - pr.amount_cents, 0)
  when pr.discount_type = 'percentagem' then round(v.price_cents::numeric * (10000 - pr.percent_bp) / 10000)::int
  else least(pr.amount_cents, v.price_cents) end)`;

// ───────────────────────────── Auxiliares ─────────────────────────────

type PricingSources = { history: Map<string, PriceHistoryLike[]>; promos: Map<string, PromotionLike[]> };

export async function loadPricingSources(tx: Tx, ids: string[]): Promise<PricingSources> {
  const history = new Map<string, PriceHistoryLike[]>();
  const promos = new Map<string, PromotionLike[]>();
  if (!ids.length) return { history, promos };
  const [h, p] = await Promise.all([
    tx<{ vehicleId: string; priceCents: number; createdAt: Date }[]>`
      select vehicle_id, price_cents, created_at from price_history
      where vehicle_id in ${tx(ids)} order by created_at`,
    tx<(PromotionLike & { vehicleId: string })[]>`
      select id, vehicle_id, discount_type, amount_cents, percent_bp, label, starts_at, ends_at, cancelled_at
      from promotions where vehicle_id in ${tx(ids)} and cancelled_at is null order by starts_at`,
  ]);
  for (const row of h) history.set(row.vehicleId, [...(history.get(row.vehicleId) ?? []), row]);
  for (const row of p) promos.set(row.vehicleId, [...(promos.get(row.vehicleId) ?? []), row]);
  return { history, promos };
}

export function pricingFor(id: string, priceCents: number | null, src: PricingSources): Pricing {
  return computePricing({
    basePriceCents: priceCents,
    history: src.history.get(id) ?? [],
    promotions: src.promos.get(id) ?? [],
  });
}

async function primaryPhotos(tx: Tx, ids: string[]): Promise<Map<string, PublicPhoto>> {
  const map = new Map<string, PublicPhoto>();
  if (!ids.length) return map;
  const rows = await tx<(PublicPhoto & { vehicleId: string })[]>`
    select distinct on (vehicle_id) id, vehicle_id, storage_key, width, height, variants, position, is_primary, alt_text, caption
    from vehicle_photos where vehicle_id in ${tx(ids)}
    order by vehicle_id, is_primary desc, position, id`;
  for (const r of rows) map.set(r.vehicleId, r);
  return map;
}

type VehicleRow = Omit<VehicleCard, "photo" | "pricing">;

async function toCards(tx: Tx, rows: VehicleRow[]): Promise<VehicleCard[]> {
  const ids = rows.map((r) => r.id);
  const [photos, sources] = await Promise.all([primaryPhotos(tx, ids), loadPricingSources(tx, ids)]);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    reference: r.reference,
    brand: r.brand,
    model: r.model,
    version: r.version,
    category: r.category,
    registrationYear: r.registrationYear,
    mileageKm: r.mileageKm,
    fuel: r.fuel,
    transmission: r.transmission,
    powerHp: r.powerHp,
    status: r.status,
    isFeatured: r.isFeatured,
    isDemo: r.isDemo,
    priceCents: r.priceCents,
    publishedAt: r.publishedAt,
    shortDescription: r.shortDescription,
    photo: photos.get(r.id) ?? null,
    pricing: pricingFor(r.id, r.priceCents, sources),
  }));
}

// ───────────────────────────── Conteúdos e definições ─────────────────────────────

export const getPublishedSite = cache(async (): Promise<{ settings: Settings; content: Content }> => {
  const rows = await asPublic(
    (tx) => tx<{ key: string; published: unknown }[]>`select key, published from site_content`,
  );
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.published]));
  return { settings: parseSettings(byKey.settings), content: parseContent(byKey.content) };
});

export async function getPublishedPage(slug: string) {
  const rows = await asPublic(
    (tx) => tx<{ slug: string; title: string; body: string; seoTitle: string | null; seoDescription: string | null; updatedAt: Date }[]>`
      select slug, title, body, seo_title, seo_description, updated_at from pages where slug = ${slug} and is_published`,
  );
  return rows[0] ?? null;
}

export async function getPublishedPageSlugs(): Promise<string[]> {
  const rows = await asPublic((tx) => tx<{ slug: string }[]>`select slug from pages where is_published`);
  return rows.map((r) => r.slug);
}

// ───────────────────────────── Catálogo ─────────────────────────────

export type CatalogFilters = {
  q?: string;
  marca?: string;
  modelo?: string;
  precoMin?: number;
  precoMax?: number;
  anoMin?: number;
  anoMax?: number;
  kmMax?: number;
  combustivel?: string;
  caixa?: string;
  categoria?: string;
  ordem?: string;
  pagina?: number;
};

export const SORTS = {
  recentes: "Mais recentes",
  preco_asc: "Preço: mais baixo",
  preco_desc: "Preço: mais alto",
  ano_desc: "Ano: mais recente",
  ano_asc: "Ano: mais antigo",
  km_asc: "Quilómetros: menos",
  km_desc: "Quilómetros: mais",
} as const;

const ORDER_SQL: Record<string, string> = {
  recentes: "published_at desc nulls last, created_at desc",
  preco_asc: "current_price_cents asc nulls last, published_at desc",
  preco_desc: "current_price_cents desc nulls last, published_at desc",
  ano_desc: "registration_year desc nulls last, published_at desc",
  ano_asc: "registration_year asc nulls last, published_at desc",
  km_asc: "mileage_km asc nulls last, published_at desc",
  km_desc: "mileage_km desc nulls last, published_at desc",
};

export type CatalogFacets = {
  brands: { value: string; count: number }[];
  models: { value: string; count: number }[];
  fuels: string[];
  transmissions: string[];
  categories: string[];
  years: { min: number | null; max: number | null };
  prices: { min: number | null; max: number | null };
};

export async function searchCatalog(filters: CatalogFilters, perPage: number, showReserved: boolean) {
  return asPublic(async (tx) => {
    const conds: ReturnType<Tx>[] = [];
    const terms = (filters.q ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8);
    for (const term of terms) {
      const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conds.push(tx`f_norm(concat_ws(' ', brand, model, version, reference, category, fuel, short_description, exterior_color)) like f_norm(${like})`);
    }
    if (filters.marca) conds.push(tx`lower(brand) = lower(${filters.marca})`);
    if (filters.modelo) conds.push(tx`lower(model) = lower(${filters.modelo})`);
    if (filters.precoMin !== undefined) conds.push(tx`current_price_cents >= ${filters.precoMin * 100}`);
    if (filters.precoMax !== undefined) conds.push(tx`current_price_cents <= ${filters.precoMax * 100}`);
    if (filters.anoMin !== undefined) conds.push(tx`registration_year >= ${filters.anoMin}`);
    if (filters.anoMax !== undefined) conds.push(tx`registration_year <= ${filters.anoMax}`);
    if (filters.kmMax !== undefined) conds.push(tx`mileage_km <= ${filters.kmMax}`);
    if (filters.combustivel) conds.push(tx`fuel = ${filters.combustivel}`);
    if (filters.caixa) conds.push(tx`transmission = ${filters.caixa}`);
    if (filters.categoria) conds.push(tx`category = ${filters.categoria}`);

    const where = conds.reduce((acc, c) => tx`${acc} and ${c}`, tx`true`);
    const order = ORDER_SQL[filters.ordem ?? "recentes"] ?? ORDER_SQL.recentes;
    const page = Math.max(1, filters.pagina ?? 1);
    const statuses = showReserved ? ["disponivel", "reservado"] : ["disponivel"];

    const base = tx`
      select ${tx.unsafe(PUBLIC_VEHICLE_COLUMNS)}, ${tx.unsafe(CURRENT_PRICE_SQL)} as current_price_cents
      from vehicles v ${tx.unsafe(ACTIVE_PROMO_JOIN)}
      where v.status in ${tx(statuses)}`;

    const rows = await tx<(VehicleRow & { total: number })[]>`
      with catalog as (${base})
      select *, count(*) over ()::int as total from catalog
      where ${where}
      order by ${tx.unsafe(order)}
      limit ${perPage} offset ${(page - 1) * perPage}`;

    const total = rows[0]?.total ?? 0;
    const [brands, models, misc] = await Promise.all([
      tx<{ value: string; count: number }[]>`
        with catalog as (${base})
        select min(brand) as value, count(*)::int as count from catalog group by lower(brand) order by 1`,
      filters.marca
        ? tx<{ value: string; count: number }[]>`
            with catalog as (${base})
            select min(model) as value, count(*)::int as count from catalog
            where lower(brand) = lower(${filters.marca}) group by lower(model) order by 1`
        : Promise.resolve([]),
      tx<{ fuels: string[] | null; transmissions: string[] | null; categories: string[] | null; minYear: number | null; maxYear: number | null; minPrice: number | null; maxPrice: number | null }[]>`
        with catalog as (${base})
        select array_agg(distinct fuel) filter (where fuel is not null) as fuels,
               array_agg(distinct transmission) filter (where transmission is not null) as transmissions,
               array_agg(distinct category) filter (where category is not null) as categories,
               min(registration_year) as min_year, max(registration_year) as max_year,
               min(current_price_cents) as min_price, max(current_price_cents) as max_price
        from catalog`,
    ]);

    const facets: CatalogFacets = {
      brands,
      models,
      fuels: misc[0]?.fuels ?? [],
      transmissions: misc[0]?.transmissions ?? [],
      categories: misc[0]?.categories ?? [],
      years: { min: misc[0]?.minYear ?? null, max: misc[0]?.maxYear ?? null },
      prices: { min: misc[0]?.minPrice ?? null, max: misc[0]?.maxPrice ?? null },
    };

    return {
      items: await toCards(tx, rows),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / perPage)),
      facets,
    };
  });
}

export async function getFeaturedVehicles(limit = 6): Promise<VehicleCard[]> {
  return asPublic(async (tx) => {
    const rows = await tx<VehicleRow[]>`
      select ${tx.unsafe(PUBLIC_VEHICLE_COLUMNS)} from vehicles v
      where v.is_featured and v.status <> 'vendido'
      order by v.status = 'disponivel' desc, v.published_at desc nulls last
      limit ${limit}`;
    return toCards(tx, rows);
  });
}

export async function getLatestVehicles(limit = 6, excludeFeatured = true): Promise<VehicleCard[]> {
  return asPublic(async (tx) => {
    const rows = await tx<VehicleRow[]>`
      select ${tx.unsafe(PUBLIC_VEHICLE_COLUMNS)} from vehicles v
      where v.status = 'disponivel' ${excludeFeatured ? tx`and not v.is_featured` : tx``}
      order by v.published_at desc nulls last, v.created_at desc
      limit ${limit}`;
    return toCards(tx, rows);
  });
}

export async function countAvailableVehicles(): Promise<number> {
  const [row] = await asPublic((tx) => tx<{ n: number }[]>`select count(*)::int as n from vehicles where status <> 'vendido'`);
  return row.n;
}

// ───────────────────────────── Página da viatura ─────────────────────────────

export async function loadVehicleDetail(tx: Tx, where: ReturnType<Tx>): Promise<VehicleDetail | null> {
  const [row] = await tx<(VehicleRow & Omit<VehicleDetail, keyof VehicleCard | "photos" | "equipment" | "extras" | "links">)[]>`
    select ${tx.unsafe(PUBLIC_VEHICLE_COLUMNS)} from vehicles v where ${where} limit 1`;
  if (!row) return null;
  const [photos, equipment, links, sources] = await Promise.all([
    tx<PublicPhoto[]>`
      select id, storage_key, width, height, variants, position, is_primary, alt_text, caption
      from vehicle_photos where vehicle_id = ${row.id} order by is_primary desc, position, id`,
    tx<{ kind: string; label: string }[]>`
      select kind, label from vehicle_equipment where vehicle_id = ${row.id} order by kind, position`,
    tx<{ id: string; kind: LinkKind; label: string | null; url: string }[]>`
      select id, kind, label, url from vehicle_links where vehicle_id = ${row.id} and is_public order by position`,
    loadPricingSources(tx, [row.id]),
  ]);
  return {
    ...row,
    photo: photos[0] ?? null,
    pricing: pricingFor(row.id, row.priceCents, sources),
    photos,
    equipment: equipment.filter((e) => e.kind === "equipamento").map((e) => e.label),
    extras: equipment.filter((e) => e.kind === "extra").map((e) => e.label),
    links,
  };
}

export const getPublicVehicle = cache(async (slug: string): Promise<VehicleDetail | null> => {
  if (!/^[a-z0-9-]{1,140}$/.test(slug)) return null;
  return asPublic((tx) => loadVehicleDetail(tx, tx`v.slug = ${slug}`));
});

export async function getSimilarVehicles(v: VehicleDetail, limit: number): Promise<VehicleCard[]> {
  if (limit <= 0) return [];
  const price = v.pricing.finalPriceCents ?? v.priceCents ?? 0;
  return asPublic(async (tx) => {
    const rows = await tx<VehicleRow[]>`
      select ${tx.unsafe(PUBLIC_VEHICLE_COLUMNS)} from vehicles v
      where v.id <> ${v.id} and v.status <> 'vendido'
        and (v.category = ${v.category} or lower(v.brand) = lower(${v.brand})
             or (v.price_cents between ${Math.round(price * 0.75)} and ${Math.round(price * 1.25)}))
      order by (lower(v.brand) = lower(${v.brand}))::int + (v.category is not distinct from ${v.category})::int desc,
               abs(coalesce(v.price_cents, 0) - ${price}) asc
      limit ${limit}`;
    return toCards(tx, rows);
  });
}

export async function listAvailableForContact(): Promise<{ id: string; label: string }[]> {
  const rows = await asPublic(
    (tx) => tx<{ id: string; brand: string; model: string; version: string | null; reference: string }[]>`
      select id, brand, model, version, reference from vehicles
      where status <> 'vendido' order by brand, model limit 300`,
  );
  return rows.map((r) => ({ id: r.id, label: `${r.brand} ${r.model}${r.version ? ` ${r.version}` : ""} (${r.reference})` }));
}

export async function sitemapVehicles(keepSold: boolean) {
  return asPublic(
    (tx) => tx<{ slug: string; updatedAt: Date }[]>`
      select slug, updated_at from vehicles where ${keepSold ? tx`true` : tx`status <> 'vendido'`}
      order by updated_at desc limit 5000`,
  );
}
