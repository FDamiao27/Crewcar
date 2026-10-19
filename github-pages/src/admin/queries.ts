import type { LeadStatus, LinkKind, VehicleStatus } from "@/lib/constants";
import { centsToInput } from "@/lib/format";
import { computePricing, findActivePromotion, type Pricing, type PriceHistoryLike, type PromotionLike } from "@/lib/pricing";
import type { AdminPhoto, AdminPromotion, AdminVehicle, AdminVehicleRow, LeadRow, PriceHistoryRow } from "@/lib/queries/admin";
import type { PublicPhoto } from "@/lib/queries/public";
import { parseContent, parseSettings, type Settings } from "@/lib/site-schema";
import type { VehicleFormState } from "@/lib/vehicle-schema";
import { adminDb, check, fetchAll, toCamel } from "./core";

// Consultas do back office (equivalentes a src/lib/queries/admin.ts, executadas pela API do Supabase).

type Row = Record<string, unknown>;
type VehicleDb = Row & {
  id: string;
  slug: string;
  reference: string;
  brand: string;
  model: string;
  version: string | null;
  vin: string | null;
  status: VehicleStatus;
  priceCents: number | null;
  purchasePriceCents: number | null;
  registrationYear: number | null;
  mileageKm: number | null;
  isPublished: boolean;
  isFeatured: boolean;
  isDemo: boolean;
  archivedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

async function userNames(): Promise<Map<string, string>> {
  const rows = await fetchAll<{ id: string; name: string }>("admin_users", "id,name");
  return new Map(rows.map((r) => [r.id, r.name]));
}

function group<T extends Row>(rows: T[], key = "vehicleId"): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = String(r[key]);
    (m.get(k) ?? m.set(k, []).get(k)!).push(r);
  }
  return m;
}

// ───────────────────────────── Viaturas ─────────────────────────────

export type StockData = {
  rows: AdminVehicleRow[];
  demoCount: number;
};

export async function loadStock(): Promise<StockData> {
  const [vehicles, photos, promos, history] = await Promise.all([
    fetchAll<VehicleDb>("vehicles", "*"),
    fetchAll<PublicPhoto & { vehicleId: string }>("vehicle_photos", "id,vehicle_id,storage_key,width,height,variants,position,is_primary,alt_text,caption"),
    fetchAll<PromotionLike & { vehicleId: string }>("promotions", "id,vehicle_id,discount_type,amount_cents,percent_bp,label,starts_at,ends_at,cancelled_at"),
    fetchAll<PriceHistoryLike & { vehicleId: string }>("price_history", "vehicle_id,price_cents,created_at", (q) => (q as { order: (c: string) => unknown }).order("created_at")),
  ]);
  const photoMap = group(photos as unknown as Row[]);
  const promoMap = group(promos as unknown as Row[]);
  const histMap = group(history as unknown as Row[]);
  const now = Date.now();
  const rows: AdminVehicleRow[] = vehicles.map((v) => {
    const vp = ((photoMap.get(v.id) ?? []) as unknown as PublicPhoto[]).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position);
    const vPromos = ((promoMap.get(v.id) ?? []) as unknown as PromotionLike[]).filter((p) => !p.cancelledAt);
    const pricing = computePricing({ basePriceCents: v.priceCents, history: (histMap.get(v.id) ?? []) as unknown as PriceHistoryLike[], promotions: vPromos });
    return {
      id: v.id,
      slug: v.slug,
      reference: v.reference,
      brand: v.brand,
      model: v.model,
      version: v.version,
      registrationYear: v.registrationYear,
      mileageKm: v.mileageKm,
      priceCents: v.priceCents,
      purchasePriceCents: v.purchasePriceCents,
      currentPriceCents: pricing.finalPriceCents,
      status: v.status,
      isPublished: v.isPublished,
      isFeatured: v.isFeatured,
      isDemo: v.isDemo,
      archivedAt: v.archivedAt ? new Date(v.archivedAt) : null,
      updatedAt: new Date(v.updatedAt),
      photo: vp[0] ?? null,
      photoCount: vp.length,
      pricing,
      scheduledPromotion: vPromos.some((p) => new Date(p.startsAt).getTime() > now),
      // campos auxiliares para pesquisa/ordenação
      ...({ vin: v.vin, createdAt: v.createdAt, activePromotion: !!findActivePromotion(vPromos, now) } as object),
    } as AdminVehicleRow;
  });
  return { rows, demoCount: vehicles.filter((v) => v.isDemo).length };
}

export function rowToForm(r: Row, equipment: { kind: string; label: string }[], links: { kind: LinkKind; label: string | null; url: string; isPublic: boolean }[]): VehicleFormState {
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

export async function loadVehicle(id: string): Promise<AdminVehicle | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = check(await adminDb.from("vehicles").select("*").eq("id", id).maybeSingle());
  if (!row) return null;
  const v = toCamel<VehicleDb>(row as Row);
  const byVehicle = (q: unknown) => (q as { eq: (c: string, v: string) => unknown }).eq("vehicle_id", id);
  const [equipment, links, photos, promotions, history, names, leads] = await Promise.all([
    fetchAll<{ kind: string; label: string; position: number }>("vehicle_equipment", "kind,label,position", byVehicle),
    fetchAll<{ kind: LinkKind; label: string | null; url: string; isPublic: boolean; position: number }>("vehicle_links", "kind,label,url,is_public,position", byVehicle),
    fetchAll<AdminPhoto>("vehicle_photos", "id,storage_key,width,height,variants,position,is_primary,alt_text,caption,bytes,created_at", byVehicle),
    fetchAll<AdminPromotion & { createdBy: string | null }>("promotions", "id,discount_type,amount_cents,percent_bp,label,starts_at,ends_at,cancelled_at,created_at,created_by", byVehicle),
    fetchAll<PriceHistoryRow & { changedBy: string | null }>("price_history", "id,price_cents,previous_price_cents,created_at,changed_by", byVehicle),
    userNames(),
    adminDb.from("leads").select("id", { count: "exact", head: true }).eq("vehicle_id", id),
  ]);
  equipment.sort((a, b) => a.kind.localeCompare(b.kind) || a.position - b.position);
  links.sort((a, b) => a.position - b.position);
  photos.sort((a, b) => a.position - b.position || String(a.createdAt).localeCompare(String(b.createdAt)));
  promotions.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || Number(b.id) - Number(a.id));
  const pricing = computePricing({ basePriceCents: v.priceCents, history: [...history].reverse(), promotions: promotions.filter((p) => !p.cancelledAt) });
  const date = (x: unknown) => (x ? new Date(String(x)) : null);
  return {
    id: v.id,
    slug: v.slug,
    reference: v.reference,
    status: v.status,
    isPublished: v.isPublished,
    isFeatured: v.isFeatured,
    isDemo: v.isDemo,
    priceCents: v.priceCents,
    purchasePriceCents: v.purchasePriceCents,
    publishedAt: date(v.publishedAt),
    reservedAt: date(v.reservedAt),
    soldAt: date(v.soldAt),
    archivedAt: date(v.archivedAt),
    createdAt: new Date(v.createdAt),
    updatedAt: new Date(v.updatedAt),
    createdByName: names.get(String(v.createdBy)) ?? null,
    updatedByName: names.get(String(v.updatedBy)) ?? null,
    form: rowToForm(v, equipment, links),
    photos,
    promotions: promotions.map((p) => ({ ...p, createdByName: p.createdBy ? (names.get(p.createdBy) ?? null) : null })),
    priceHistory: history.map((h) => ({ ...h, id: String(h.id), changedByName: h.changedBy ? (names.get(h.changedBy) ?? null) : null })),
    pricing,
    leadCount: leads.count ?? 0,
  };
}

export async function loadPricingDetails(ids: string[]) {
  if (!ids.length) return { promos: new Map<string, AdminPromotion[]>(), history: new Map<string, PriceHistoryRow[]>() };
  const names = await userNames();
  const [promos, history] = await Promise.all([
    fetchAll<AdminPromotion & { vehicleId: string; createdBy: string | null }>(
      "promotions",
      "id,vehicle_id,discount_type,amount_cents,percent_bp,label,starts_at,ends_at,cancelled_at,created_at,created_by",
      (q) => (q as { in: (c: string, v: string[]) => unknown }).in("vehicle_id", ids),
    ),
    fetchAll<PriceHistoryRow & { vehicleId: string; changedBy: string | null }>(
      "price_history",
      "id,vehicle_id,price_cents,previous_price_cents,created_at,changed_by",
      (q) => (q as { in: (c: string, v: string[]) => unknown }).in("vehicle_id", ids),
    ),
  ]);
  promos.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const pm = new Map<string, AdminPromotion[]>();
  for (const p of promos) (pm.get(p.vehicleId) ?? pm.set(p.vehicleId, []).get(p.vehicleId)!).push({ ...p, createdByName: p.createdBy ? (names.get(p.createdBy) ?? null) : null });
  const hm = new Map<string, PriceHistoryRow[]>();
  for (const h of history) (hm.get(h.vehicleId) ?? hm.set(h.vehicleId, []).get(h.vehicleId)!).push({ ...h, id: String(h.id), changedByName: h.changedBy ? (names.get(h.changedBy) ?? null) : null });
  return { promos: pm, history: hm };
}

// ───────────────────────────── Contactos ─────────────────────────────

export async function loadLeads(): Promise<LeadRow[]> {
  const [leads, vehicles, notes] = await Promise.all([
    fetchAll<LeadRow>("leads", "id,name,email,phone,vehicle_id,vehicle_label,subject,message,source,status,created_at,updated_at"),
    fetchAll<{ id: string; slug: string }>("vehicles", "id,slug"),
    fetchAll<{ leadId: string }>("lead_activity", "lead_id", (q) => (q as { eq: (c: string, v: string) => unknown }).eq("kind", "nota")),
  ]);
  const slugs = new Map(vehicles.map((v) => [v.id, v.slug]));
  const noteCount = new Map<string, number>();
  for (const n of notes) noteCount.set(n.leadId, (noteCount.get(n.leadId) ?? 0) + 1);
  return leads
    .map((l) => ({
      ...l,
      createdAt: new Date(l.createdAt),
      updatedAt: new Date(l.updatedAt),
      vehicleSlug: l.vehicleId ? (slugs.get(l.vehicleId) ?? null) : null,
      noteCount: noteCount.get(l.id) ?? 0,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export type LeadActivity = { id: string; kind: "criado" | "estado" | "nota"; fromStatus: LeadStatus | null; toStatus: LeadStatus | null; body: string | null; createdAt: Date; actorName: string | null };

export async function loadLead(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = check(await adminDb.from("leads").select("*").eq("id", id).maybeSingle());
  if (!row) return null;
  const lead = toCamel<LeadRow & { referrer: string | null; consentAt: string | null; vehicleReference: string | null }>(row as Row);
  const [activity, names, vehicle, others] = await Promise.all([
    fetchAll<LeadActivity & { actorId: string | null }>("lead_activity", "id,kind,from_status,to_status,body,created_at,actor_id", (q) =>
      (q as { eq: (c: string, v: string) => unknown }).eq("lead_id", id),
    ),
    userNames(),
    lead.vehicleId ? adminDb.from("vehicles").select("slug,reference").eq("id", lead.vehicleId).maybeSingle() : Promise.resolve({ data: null }),
    fetchAll<{ id: string; createdAt: string; status: LeadStatus; vehicleLabel: string | null; email: string | null; phone: string | null }>(
      "leads",
      "id,created_at,status,vehicle_label,email,phone",
    ),
  ]);
  const v = vehicle.data as { slug: string; reference: string } | null;
  return {
    lead: {
      ...lead,
      createdAt: new Date(lead.createdAt),
      updatedAt: new Date(lead.updatedAt),
      consentAt: lead.consentAt ? new Date(lead.consentAt) : null,
      vehicleSlug: v?.slug ?? null,
      vehicleReference: v?.reference ?? null,
      noteCount: 0,
    },
    activity: activity
      .map((a) => ({ ...a, id: String(a.id), createdAt: new Date(a.createdAt), actorName: a.actorId ? (names.get(a.actorId) ?? null) : null }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || Number(b.id) - Number(a.id)),
    otherLeads: others
      .filter((o) => o.id !== id && ((lead.email && o.email === lead.email) || (lead.phone && o.phone === lead.phone)))
      .map((o) => ({ ...o, createdAt: new Date(o.createdAt) }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10),
  };
}

// ───────────────────────────── Conteúdos, páginas, definições, utilizadores ─────────────────────────────

export async function loadContentDocs() {
  const rows = await fetchAll<{ key: string; draft: unknown; published: unknown; updatedAt: string; publishedAt: string | null }>(
    "site_content",
    "key,draft,published,updated_at,published_at",
  );
  const content = rows.find((r) => r.key === "content");
  const draft = parseContent(content?.draft);
  const published = parseContent(content?.published);
  return {
    contentDraft: draft,
    hasUnpublished: JSON.stringify(draft) !== JSON.stringify(published),
    contentPublishedAt: content?.publishedAt ? new Date(content.publishedAt) : null,
  };
}

export async function loadSettings(): Promise<Settings> {
  const row = check(await adminDb.from("site_content").select("published").eq("key", "settings").maybeSingle());
  return parseSettings((row as { published?: unknown } | null)?.published);
}

export async function loadPages() {
  const pages = await fetchAll<{ slug: string; title: string; body: string; isPublished: boolean; updatedAt: string }>("pages", "slug,title,body,is_published,updated_at");
  return pages
    .map((p) => ({ ...p, updatedAt: new Date(p.updatedAt), hasPlaceholders: /\[[^\]]+\]/.test(p.body) }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function loadPage(slug: string) {
  const row = check(await adminDb.from("pages").select("slug,title,body,is_published,seo_title,seo_description,updated_at").eq("slug", slug).maybeSingle());
  return row ? toCamel<{ slug: string; title: string; body: string; isPublished: boolean; seoTitle: string | null; seoDescription: string | null; updatedAt: string }>(row as Row) : null;
}

export async function loadUsers() {
  const users = await fetchAll<{ id: string; email: string; name: string; role: "owner" | "admin" | "editor"; isActive: boolean; lastLoginAt: string | null; createdAt: string; lockedUntil: string | null }>(
    "admin_users",
    "id,email,name,role,is_active,last_login_at,created_at,locked_until",
  );
  const order = { owner: 0, admin: 1, editor: 2 };
  return users
    .map((u) => ({ ...u, lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null, createdAt: new Date(u.createdAt), lockedUntil: u.lockedUntil ? new Date(u.lockedUntil) : null }))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || order[a.role] - order[b.role] || a.name.localeCompare(b.name));
}

// ───────────────────────────── Painel ─────────────────────────────

export async function loadDashboard() {
  const [stock, leads, activity, names, pages, settings] = await Promise.all([
    loadStock(),
    fetchAll<{ id: string; name: string; vehicleLabel: string | null; status: LeadStatus; createdAt: string }>("leads", "id,name,vehicle_label,status,created_at"),
    fetchAll<{ id: string; action: string; entityType: string; entityId: string | null; summary: string; createdAt: string; actorId: string | null }>(
      "activity_log",
      "id,action,entity_type,entity_id,summary,created_at,actor_id",
      (q) => (q as { order: (c: string, o: object) => { limit: (n: number) => unknown } }).order("created_at", { ascending: false }).limit(12),
    ),
    userNames(),
    fetchAll<{ isPublished: boolean }>("pages", "is_published"),
    loadSettings(),
  ]);
  const active = stock.rows.filter((v) => !v.archivedAt);
  const unsold = active.filter((v) => v.status !== "vendido");
  const stockRows = active.filter((v) => v.status === "disponivel" || v.status === "reservado");
  const weekAgo = Date.now() - 7 * 86_400_000;
  return {
    stats: {
      total: active.length,
      available: active.filter((v) => v.status === "disponivel").length,
      reserved: active.filter((v) => v.status === "reservado").length,
      sold: active.filter((v) => v.status === "vendido").length,
      featured: unsold.filter((v) => v.isFeatured).length,
      published: unsold.filter((v) => v.isPublished).length,
      drafts: unsold.filter((v) => !v.isPublished).length,
      discounted: unsold.filter((v) => (v as unknown as { activePromotion: boolean }).activePromotion).length,
      stockValue: stockRows.reduce((s, v) => s + (v.currentPriceCents ?? 0), 0),
      stockCost: stockRows.reduce((s, v) => s + (v.purchasePriceCents ?? 0), 0),
      withoutPhotos: unsold.filter((v) => v.photoCount === 0).length,
    },
    leads: {
      newLeads: leads.filter((l) => l.status === "novo").length,
      pending: leads.filter((l) => ["novo", "em_contacto", "em_negociacao"].includes(l.status)).length,
      last7: leads.filter((l) => new Date(l.createdAt).getTime() > weekAgo).length,
    },
    activity: activity.map((a) => ({ ...a, id: String(a.id), createdAt: new Date(a.createdAt), actorName: a.actorId ? (names.get(a.actorId) ?? null) : null })),
    recentLeads: [...leads]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)
      .map((l) => ({ ...l, createdAt: new Date(l.createdAt) })),
    checks: {
      hasContacts: Boolean(settings.contact.phone || settings.contact.email),
      publishedPages: pages.filter((p) => p.isPublished).length,
      totalPages: pages.length,
    },
  };
}

export type { Pricing };
