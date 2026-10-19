import { createClient } from "@supabase/supabase-js";
import type { LinkKind } from "@/lib/constants";
import { computePricing, type PriceHistoryLike, type PromotionLike } from "@/lib/pricing";
import type { PublicPhoto, VehicleDetail } from "@/lib/queries/public";
import { parseContent, parseSettings, type Content, type Settings } from "@/lib/site-schema";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

// Leitura dos dados públicos diretamente da API do Supabase. A base de dados só devolve
// colunas e linhas públicas (viaturas publicadas, conteúdos publicados) a esta chave.

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export type PublicPage = { slug: string; title: string; body: string; seoTitle: string | null; seoDescription: string | null; updatedAt: string };

export type Showroom = {
  settings: Settings;
  content: Content;
  pages: PublicPage[];
  vehicles: VehicleDetail[];
};

const VEHICLE_COLUMNS = [
  "id", "slug", "reference", "brand", "model", "version", "category", "registration_year", "first_registration_date",
  "mileage_km", "fuel", "transmission", "engine_cc", "power_hp", "exterior_color", "interior_color", "doors", "seats",
  "condition", "price_cents", "short_description", "description", "warranty_info", "warranty_verified", "commercial_info",
  "video_url", "status", "is_published", "is_featured", "is_demo", "seo_title", "seo_description", "published_at", "sold_at",
  "created_at", "updated_at",
].join(",");

type Row = Record<string, unknown>;

function toCamel(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  return out;
}

/** Lê todas as linhas (a API devolve no máximo 1000 de cada vez). */
async function fetchAll(table: string, columns: string, order: string[] = []): Promise<Row[]> {
  const rows: Row[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    let q = supabase.from(table).select(columns).range(from, from + size - 1);
    for (const o of order) q = q.order(o);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as unknown as Row[]).map(toCamel));
    if (!data || data.length < size) break;
  }
  return rows;
}

function groupBy<T extends Row>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const key = String(r.vehicleId);
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  return map;
}

const PREVIEW_KEY = "cc-preview";

export function isPreview(): boolean {
  try {
    return sessionStorage.getItem(PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPreview(on: boolean) {
  try {
    if (on) sessionStorage.setItem(PREVIEW_KEY, "1");
    else sessionStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* armazenamento indisponível */
  }
}

export async function loadShowroom(): Promise<Showroom> {
  const [content, pages, vehicles, photos, equipment, links, promotions, history] = await Promise.all([
    fetchAll("site_content", "key,published"),
    fetchAll("pages", "slug,title,body,seo_title,seo_description,updated_at", ["slug"]),
    fetchAll("vehicles", VEHICLE_COLUMNS, ["id"]),
    fetchAll("vehicle_photos", "id,vehicle_id,storage_key,width,height,variants,position,is_primary,alt_text,caption", ["id"]),
    fetchAll("vehicle_equipment", "vehicle_id,kind,label,position", ["vehicle_id", "position"]),
    fetchAll("vehicle_links", "id,vehicle_id,kind,label,url,position", ["vehicle_id", "position"]),
    fetchAll("promotions", "id,vehicle_id,discount_type,amount_cents,percent_bp,label,starts_at,ends_at,cancelled_at", ["id"]),
    fetchAll("price_history", "vehicle_id,price_cents,created_at", ["created_at"]),
  ]);

  const byKey = Object.fromEntries(content.map((c) => [c.key as string, c.published]));
  const photoMap = groupBy(photos);
  const equipmentMap = groupBy(equipment);
  const linkMap = groupBy(links);
  const promoMap = groupBy(promotions);
  const historyMap = groupBy(history);

  const details: VehicleDetail[] = vehicles.map((raw) => {
    const v = raw as unknown as VehicleDetail;
    const vPhotos = ((photoMap.get(v.id) ?? []) as unknown as PublicPhoto[]).sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position,
    );
    const vEquipment = (equipmentMap.get(v.id) ?? []).sort((a, b) => Number(a.position) - Number(b.position));
    const pricing = computePricing({
      basePriceCents: v.priceCents,
      history: (historyMap.get(v.id) ?? []) as unknown as PriceHistoryLike[],
      promotions: (promoMap.get(v.id) ?? []).filter((p) => !p.cancelledAt) as unknown as PromotionLike[],
    });
    return {
      ...v,
      photo: vPhotos[0] ?? null,
      photos: vPhotos,
      pricing,
      equipment: vEquipment.filter((e) => e.kind === "equipamento").map((e) => String(e.label)),
      extras: vEquipment.filter((e) => e.kind === "extra").map((e) => String(e.label)),
      links: (linkMap.get(v.id) ?? []).map((l) => ({ id: String(l.id), kind: l.kind as LinkKind, label: (l.label as string) ?? null, url: String(l.url) })),
    };
  });

  // Pré-visualização de rascunhos (apenas com sessão de administrador; a base de dados
  // só devolve o rascunho a administradores autenticados)
  let contentDoc = byKey.content;
  if (isPreview()) {
    const { adminDb } = await import("./admin/core");
    const { data } = await adminDb.from("site_content").select("draft").eq("key", "content").maybeSingle();
    if (data?.draft) contentDoc = data.draft;
  }

  return {
    settings: parseSettings(byKey.settings),
    content: parseContent(contentDoc),
    pages: pages as unknown as PublicPage[],
    vehicles: details,
  };
}

/** Envia um pedido de contacto (a base de dados valida, limita e regista o pedido). */
export async function insertLead(lead: {
  name: string;
  email: string | null;
  phone: string | null;
  vehicleId: string | null;
  subject: string | null;
  message: string;
  source: string;
  referrer: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("leads").insert({
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    vehicle_id: lead.vehicleId,
    subject: lead.subject,
    message: lead.message,
    source: lead.source,
    referrer: lead.referrer,
    consent_at: new Date().toISOString(),
  });
  if (!error) return { ok: true };
  // Mensagens das regras anti-spam da base de dados (código P0001) são apresentadas ao visitante
  if (error.code === "P0001" && error.message) return { ok: false, message: error.message };
  console.error("Falha ao enviar contacto", error);
  return { ok: false, message: "Não foi possível enviar a mensagem. Tente novamente dentro de instantes." };
}
