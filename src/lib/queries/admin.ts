import "server-only";
import { sql, type Tx } from "@/lib/db";
import type { LeadStatus, LinkKind, VehicleStatus } from "@/lib/constants";
import { computePricing, type Pricing, type PromotionLike } from "@/lib/pricing";
import { parseContent, parseSettings } from "@/lib/site-schema";
import { centsToInput } from "@/lib/format";
import type { VehicleFormState } from "@/lib/vehicle-schema";
import { ACTIVE_PROMO_JOIN, CURRENT_PRICE_SQL, loadPricingSources, pricingFor, type PublicPhoto } from "./public";

// Consultas do back office. Executadas com a role da aplicação (acesso total), mas apenas
// depois de a sessão e as permissões terem sido verificadas no servidor.

const t = () => sql as unknown as Tx;

// ───────────────────────────── Viaturas ─────────────────────────────

export type AdminVehicleRow = {
  id: string;
  slug: string;
  reference: string;
  brand: string;
  model: string;
  version: string | null;
  registrationYear: number | null;
  mileageKm: number | null;
  priceCents: number | null;
  purchasePriceCents: number | null;
  currentPriceCents: number | null;
  status: VehicleStatus;
  isPublished: boolean;
  isFeatured: boolean;
  isDemo: boolean;
  archivedAt: Date | null;
  updatedAt: Date;
  photo: PublicPhoto | null;
  photoCount: number;
  pricing: Pricing;
  scheduledPromotion: boolean;
};

export type AdminVehicleFilters = {
  q?: string;
  estado?: string;
  publicacao?: string;
  vista?: string; // "ativas" | "arquivadas" | "todas"
  desconto?: string; // "com" | "sem" | "agendado"
  ordem?: string;
  pagina?: number;
};

const ADMIN_ORDERS: Record<string, string> = {
  atualizadas: "updated_at desc",
  recentes: "created_at desc",
  referencia: "lower(reference) asc",
  marca: "lower(brand) asc, lower(model) asc",
  preco_asc: "current_price_cents asc nulls last",
  preco_desc: "current_price_cents desc nulls last",
  km_asc: "mileage_km asc nulls last",
  ano_desc: "registration_year desc nulls last",
};

export async function listAdminVehicles(f: AdminVehicleFilters, perPage = 25) {
  const tx = t();
  const conds: ReturnType<Tx>[] = [];
  const vista = f.vista ?? "ativas";
  if (vista === "ativas") conds.push(tx`archived_at is null`);
  if (vista === "arquivadas") conds.push(tx`archived_at is not null`);
  if (f.estado && ["disponivel", "reservado", "vendido"].includes(f.estado)) conds.push(tx`status = ${f.estado}`);
  if (f.publicacao === "publicadas") conds.push(tx`is_published`);
  if (f.publicacao === "rascunho") conds.push(tx`not is_published`);
  if (f.publicacao === "destaque") conds.push(tx`is_featured`);
  if (f.desconto === "com") conds.push(tx`promo_id is not null`);
  if (f.desconto === "sem") conds.push(tx`promo_id is null`);
  if (f.desconto === "agendado") conds.push(tx`has_scheduled`);
  for (const term of (f.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 6)) {
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conds.push(tx`f_norm(concat_ws(' ', reference, brand, model, version, vin, slug)) like f_norm(${like})`);
  }
  const where = conds.reduce((acc, c) => tx`${acc} and ${c}`, tx`true`);
  const order = ADMIN_ORDERS[f.ordem ?? "atualizadas"] ?? ADMIN_ORDERS.atualizadas;
  const page = Math.max(1, f.pagina ?? 1);

  const rows = await tx<(Omit<AdminVehicleRow, "photo" | "pricing" | "scheduledPromotion"> & { total: number; hasScheduled: boolean })[]>`
    with base as (
      select v.id, v.slug, v.reference, v.brand, v.model, v.version, v.registration_year, v.mileage_km, v.vin,
             v.price_cents, v.purchase_price_cents, v.status, v.is_published, v.is_featured, v.is_demo,
             v.archived_at, v.updated_at, v.created_at, pr.id as promo_id,
             ${tx.unsafe(CURRENT_PRICE_SQL)} as current_price_cents,
             exists (select 1 from promotions sp where sp.vehicle_id = v.id and sp.cancelled_at is null and sp.starts_at > now()) as has_scheduled,
             (select count(*)::int from vehicle_photos ph where ph.vehicle_id = v.id) as photo_count
      from vehicles v ${tx.unsafe(ACTIVE_PROMO_JOIN)}
    )
    select *, count(*) over ()::int as total from base
    where ${where}
    order by ${tx.unsafe(order)}, id
    limit ${perPage} offset ${(page - 1) * perPage}`;

  const ids = rows.map((r) => r.id);
  const [photos, sources] = await Promise.all([
    ids.length
      ? tx<(PublicPhoto & { vehicleId: string })[]>`
          select distinct on (vehicle_id) id, vehicle_id, storage_key, width, height, variants, position, is_primary, alt_text, caption
          from vehicle_photos where vehicle_id in ${tx(ids)} order by vehicle_id, is_primary desc, position`
      : Promise.resolve([]),
    loadPricingSources(tx, ids),
  ]);
  const photoMap = new Map(photos.map((p) => [p.vehicleId, p]));
  const total = rows[0]?.total ?? 0;
  return {
    items: rows.map((r) => ({
      ...r,
      photo: photoMap.get(r.id) ?? null,
      pricing: pricingFor(r.id, r.priceCents, sources),
      scheduledPromotion: r.hasScheduled,
    })) as AdminVehicleRow[],
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export type AdminPhoto = PublicPhoto & { bytes: number; createdAt: Date };
export type AdminPromotion = PromotionLike & { id: string; createdAt: Date; createdByName: string | null };
export type PriceHistoryRow = { id: string; priceCents: number; previousPriceCents: number | null; createdAt: Date; changedByName: string | null };

export type AdminVehicle = {
  id: string;
  slug: string;
  reference: string;
  status: VehicleStatus;
  isPublished: boolean;
  isFeatured: boolean;
  isDemo: boolean;
  priceCents: number | null;
  purchasePriceCents: number | null;
  publishedAt: Date | null;
  reservedAt: Date | null;
  soldAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdByName: string | null;
  updatedByName: string | null;
  form: VehicleFormState;
  photos: AdminPhoto[];
  promotions: AdminPromotion[];
  priceHistory: PriceHistoryRow[];
  pricing: Pricing;
  leadCount: number;
};

type VehicleDbRow = Record<string, unknown> & {
  id: string;
  slug: string;
  reference: string;
  status: VehicleStatus;
  priceCents: number | null;
  purchasePriceCents: number | null;
};

export function rowToForm(r: Record<string, unknown>, equipment: { kind: string; label: string }[], links: { kind: LinkKind; label: string | null; url: string; isPublic: boolean }[]): VehicleFormState {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    brand: s(r.brand),
    model: s(r.model),
    version: s(r.version),
    category: s(r.category),
    reference: s(r.reference),
    registrationYear: s(r.registrationYear),
    firstRegistrationDate: s(r.firstRegistrationDate),
    mileageKm: s(r.mileageKm),
    fuel: s(r.fuel),
    transmission: s(r.transmission),
    engineCc: s(r.engineCc),
    powerHp: s(r.powerHp),
    exteriorColor: s(r.exteriorColor),
    interiorColor: s(r.interiorColor),
    doors: s(r.doors),
    seats: s(r.seats),
    condition: s(r.condition),
    vin: s(r.vin),
    purchasePrice: centsToInput(r.purchasePriceCents as number | null),
    price: centsToInput(r.priceCents as number | null),
    shortDescription: s(r.shortDescription),
    description: s(r.description),
    warrantyInfo: s(r.warrantyInfo),
    warrantyVerified: Boolean(r.warrantyVerified),
    commercialInfo: s(r.commercialInfo),
    internalNotes: s(r.internalNotes),
    videoUrl: s(r.videoUrl),
    equipment: equipment.filter((e) => e.kind === "equipamento").map((e) => e.label),
    extras: equipment.filter((e) => e.kind === "extra").map((e) => e.label),
    links: links.map((l) => ({ kind: l.kind, label: l.label ?? "", url: l.url, isPublic: l.isPublic })),
    status: r.status as VehicleStatus,
    isPublished: Boolean(r.isPublished),
    isFeatured: Boolean(r.isFeatured),
    seoTitle: s(r.seoTitle),
    seoDescription: s(r.seoDescription),
    slug: s(r.slug),
  };
}

export async function getAdminVehicle(id: string): Promise<AdminVehicle | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const tx = t();
  const [row] = await tx<VehicleDbRow[]>`
    select v.*, cu.name as created_by_name, uu.name as updated_by_name,
           (select count(*)::int from leads l where l.vehicle_id = v.id) as lead_count
    from vehicles v
    left join admin_users cu on cu.id = v.created_by
    left join admin_users uu on uu.id = v.updated_by
    where v.id = ${id}`;
  if (!row) return null;
  const [equipment, links, photos, promotions, history] = await Promise.all([
    tx<{ kind: string; label: string }[]>`select kind, label from vehicle_equipment where vehicle_id = ${id} order by kind, position`,
    tx<{ kind: LinkKind; label: string | null; url: string; isPublic: boolean }[]>`
      select kind, label, url, is_public from vehicle_links where vehicle_id = ${id} order by position`,
    tx<AdminPhoto[]>`
      select id, storage_key, width, height, variants, position, is_primary, alt_text, caption, bytes, created_at
      from vehicle_photos where vehicle_id = ${id} order by position, created_at`,
    tx<AdminPromotion[]>`
      select p.id, p.discount_type, p.amount_cents, p.percent_bp, p.label, p.starts_at, p.ends_at, p.cancelled_at, p.created_at,
             u.name as created_by_name
      from promotions p left join admin_users u on u.id = p.created_by
      where p.vehicle_id = ${id} order by p.starts_at desc`,
    tx<PriceHistoryRow[]>`
      select h.id, h.price_cents, h.previous_price_cents, h.created_at, u.name as changed_by_name
      from price_history h left join admin_users u on u.id = h.changed_by
      where h.vehicle_id = ${id} order by h.created_at desc, h.id desc`,
  ]);
  const pricing = computePricing({
    basePriceCents: row.priceCents,
    history: [...history].reverse(),
    promotions: promotions.filter((p) => !p.cancelledAt),
  });
  return {
    id: row.id,
    slug: row.slug,
    reference: row.reference,
    status: row.status,
    isPublished: Boolean(row.isPublished),
    isFeatured: Boolean(row.isFeatured),
    isDemo: Boolean(row.isDemo),
    priceCents: row.priceCents,
    purchasePriceCents: row.purchasePriceCents,
    publishedAt: row.publishedAt as Date | null,
    reservedAt: row.reservedAt as Date | null,
    soldAt: row.soldAt as Date | null,
    archivedAt: row.archivedAt as Date | null,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
    createdByName: row.createdByName as string | null,
    updatedByName: row.updatedByName as string | null,
    form: rowToForm(row, equipment, links),
    photos,
    promotions,
    priceHistory: history,
    pricing,
    leadCount: row.leadCount as number,
  };
}

// ───────────────────────────── Dashboard ─────────────────────────────

export async function getDashboard() {
  const tx = t();
  const [stats] = await tx<
    {
      total: number;
      available: number;
      reserved: number;
      sold: number;
      featured: number;
      published: number;
      drafts: number;
      discounted: number;
      stockValue: string | null;
      stockCost: string | null;
      withoutPhotos: number;
    }[]
  >`
    with base as (
      select v.*, pr.id as promo_id, ${tx.unsafe(CURRENT_PRICE_SQL)} as current_price_cents,
             exists (select 1 from vehicle_photos ph where ph.vehicle_id = v.id) as has_photos
      from vehicles v ${tx.unsafe(ACTIVE_PROMO_JOIN)}
      where v.archived_at is null
    )
    select count(*)::int as total,
           count(*) filter (where status = 'disponivel')::int as available,
           count(*) filter (where status = 'reservado')::int as reserved,
           count(*) filter (where status = 'vendido')::int as sold,
           count(*) filter (where is_featured and status <> 'vendido')::int as featured,
           count(*) filter (where is_published and status <> 'vendido')::int as published,
           count(*) filter (where not is_published and status <> 'vendido')::int as drafts,
           count(*) filter (where promo_id is not null and status <> 'vendido')::int as discounted,
           sum(current_price_cents) filter (where status in ('disponivel', 'reservado'))::text as stock_value,
           sum(purchase_price_cents) filter (where status in ('disponivel', 'reservado'))::text as stock_cost,
           count(*) filter (where not has_photos and status <> 'vendido')::int as without_photos
    from base`;
  const [leads] = await tx<{ newLeads: number; pending: number; last7: number }[]>`
    select count(*) filter (where status = 'novo')::int as new_leads,
           count(*) filter (where status in ('novo', 'em_contacto', 'em_negociacao'))::int as pending,
           count(*) filter (where created_at > now() - interval '7 days')::int as last7
    from leads`;
  const activity = await tx<{ id: string; action: string; entityType: string; entityId: string | null; summary: string; createdAt: Date; actorName: string | null }[]>`
    select a.id, a.action, a.entity_type, a.entity_id, a.summary, a.created_at, u.name as actor_name
    from activity_log a left join admin_users u on u.id = a.actor_id
    order by a.created_at desc limit 12`;
  const recentLeads = await tx<{ id: string; name: string; vehicleLabel: string | null; status: LeadStatus; createdAt: Date }[]>`
    select id, name, vehicle_label, status, created_at from leads order by created_at desc limit 6`;
  const [checks] = await tx<{ hasContacts: boolean; publishedPages: number; totalPages: number }[]>`
    select coalesce((published->'contact'->>'phone') <> '' or (published->'contact'->>'email') <> '', false) as has_contacts,
           (select count(*)::int from pages where is_published) as published_pages,
           (select count(*)::int from pages) as total_pages
    from site_content where key = 'settings'`;
  return {
    stats: {
      ...stats,
      stockValue: Number(stats.stockValue ?? 0),
      stockCost: Number(stats.stockCost ?? 0),
    },
    leads,
    activity,
    recentLeads,
    checks: checks ?? { hasContacts: false, publishedPages: 0, totalPages: 0 },
  };
}

// ───────────────────────────── Contactos ─────────────────────────────

export type LeadRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  vehicleId: string | null;
  vehicleLabel: string | null;
  vehicleSlug: string | null;
  subject: string | null;
  message: string;
  source: string | null;
  status: LeadStatus;
  createdAt: Date;
  updatedAt: Date;
  noteCount: number;
};

export async function listLeads(f: { q?: string; estado?: string; pagina?: number }, perPage = 25) {
  const tx = t();
  const conds: ReturnType<Tx>[] = [];
  if (f.estado === "pendentes") conds.push(tx`l.status in ('novo', 'em_contacto', 'em_negociacao')`);
  else if (f.estado) conds.push(tx`l.status = ${f.estado}`);
  for (const term of (f.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 6)) {
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conds.push(tx`f_norm(concat_ws(' ', l.name, l.email, l.phone, l.vehicle_label, l.message)) like f_norm(${like})`);
  }
  const where = conds.reduce((acc, c) => tx`${acc} and ${c}`, tx`true`);
  const page = Math.max(1, f.pagina ?? 1);
  const rows = await tx<(LeadRow & { total: number })[]>`
    select l.*, v.slug as vehicle_slug,
           (select count(*)::int from lead_activity a where a.lead_id = l.id and a.kind = 'nota') as note_count,
           count(*) over ()::int as total
    from leads l left join vehicles v on v.id = l.vehicle_id
    where ${where}
    order by l.created_at desc
    limit ${perPage} offset ${(page - 1) * perPage}`;
  const counts = await tx<{ status: LeadStatus; n: number }[]>`select status, count(*)::int as n from leads group by status`;
  const total = rows[0]?.total ?? 0;
  return { items: rows, total, page, pages: Math.max(1, Math.ceil(total / perPage)), counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number> };
}

export async function getLead(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const tx = t();
  const [lead] = await tx<(LeadRow & { referrer: string | null; consentAt: Date | null; vehicleReference: string | null })[]>`
    select l.*, v.slug as vehicle_slug, v.reference as vehicle_reference, 0 as note_count
    from leads l left join vehicles v on v.id = l.vehicle_id where l.id = ${id}`;
  if (!lead) return null;
  const activity = await tx<{ id: string; kind: "criado" | "estado" | "nota"; fromStatus: LeadStatus | null; toStatus: LeadStatus | null; body: string | null; createdAt: Date; actorName: string | null }[]>`
    select a.id, a.kind, a.from_status, a.to_status, a.body, a.created_at, u.name as actor_name
    from lead_activity a left join admin_users u on u.id = a.actor_id
    where a.lead_id = ${id} order by a.created_at desc, a.id desc`;
  const otherLeads = await tx<{ id: string; createdAt: Date; status: LeadStatus; vehicleLabel: string | null }[]>`
    select id, created_at, status, vehicle_label from leads
    where id <> ${id} and ((${lead.email}::text is not null and email = ${lead.email}) or (${lead.phone}::text is not null and phone = ${lead.phone}))
    order by created_at desc limit 10`;
  return { lead, activity, otherLeads };
}

// ───────────────────────────── Conteúdos, páginas e utilizadores ─────────────────────────────

export async function getContentDocs() {
  const rows = await sql<{ key: string; draft: unknown; published: unknown; updatedAt: Date; publishedAt: Date | null }[]>`
    select key, draft, published, updated_at, published_at from site_content`;
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const content = byKey.content;
  const draft = parseContent(content?.draft);
  const published = parseContent(content?.published);
  return {
    settings: parseSettings(byKey.settings?.published),
    contentDraft: draft,
    contentPublished: published,
    hasUnpublished: JSON.stringify(draft) !== JSON.stringify(published),
    contentPublishedAt: content?.publishedAt ?? null,
    contentUpdatedAt: content?.updatedAt ?? null,
  };
}

export async function getAdminSettings() {
  const [row] = await sql<{ published: unknown }[]>`select published from site_content where key = 'settings'`;
  return parseSettings(row?.published);
}

export async function listPages() {
  return sql<{ slug: string; title: string; isPublished: boolean; updatedAt: Date; hasPlaceholders: boolean }[]>`
    select slug, title, is_published, updated_at, body ~ '\\[[^\\]]+\\]' as has_placeholders from pages order by slug`;
}

export async function getPage(slug: string) {
  const [row] = await sql<{ slug: string; title: string; body: string; isPublished: boolean; seoTitle: string | null; seoDescription: string | null; updatedAt: Date }[]>`
    select slug, title, body, is_published, seo_title, seo_description, updated_at from pages where slug = ${slug}`;
  return row ?? null;
}

export async function listUsers() {
  return sql<{ id: string; email: string; name: string; role: "owner" | "admin" | "editor"; isActive: boolean; lastLoginAt: Date | null; createdAt: Date; lockedUntil: Date | null }[]>`
    select id, email, name, role, is_active, last_login_at, created_at, locked_until from admin_users order by is_active desc, role, name`;
}

export async function countNewLeads(): Promise<number> {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from leads where status = 'novo'`;
  return r.n;
}
