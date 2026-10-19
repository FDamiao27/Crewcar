import type { AdminVehicleRow, LeadRow } from "@/lib/queries/admin";

// Filtros, ordenação e paginação das listas do back office (equivalentes às consultas
// de src/lib/queries/admin.ts, aplicados no navegador sobre os dados carregados).

type Extra = { vin: string | null; createdAt: string; activePromotion: boolean };
const extra = (v: AdminVehicleRow) => v as unknown as AdminVehicleRow & Extra;

/** Igual a f_norm() na base de dados: minúsculas e sem acentos. */
export function norm(text: string | null | undefined): string {
  return (text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function matches(haystack: (string | null | undefined)[], q?: string): boolean {
  const terms = norm(q).split(/\s+/).filter(Boolean).slice(0, 6);
  if (!terms.length) return true;
  const text = norm(haystack.filter(Boolean).join(" "));
  return terms.every((t) => text.includes(t));
}

function paginate<T>(items: T[], page: number, perPage: number) {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const p = Math.max(1, page);
  return { items: items.slice((p - 1) * perPage, p * perPage), total: items.length, page: p, pages };
}

const nullsLast = (a: number | null, b: number | null, dir: 1 | -1) => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : (a - b) * dir);
const time = (d: Date | string) => new Date(d).getTime();

const ORDERS: Record<string, (a: AdminVehicleRow, b: AdminVehicleRow) => number> = {
  atualizadas: (a, b) => time(b.updatedAt) - time(a.updatedAt),
  recentes: (a, b) => time(extra(b).createdAt) - time(extra(a).createdAt),
  referencia: (a, b) => a.reference.toLowerCase().localeCompare(b.reference.toLowerCase()),
  marca: (a, b) => a.brand.toLowerCase().localeCompare(b.brand.toLowerCase()) || a.model.toLowerCase().localeCompare(b.model.toLowerCase()),
  preco_asc: (a, b) => nullsLast(a.currentPriceCents, b.currentPriceCents, 1),
  preco_desc: (a, b) => nullsLast(a.currentPriceCents, b.currentPriceCents, -1),
  km_asc: (a, b) => nullsLast(a.mileageKm, b.mileageKm, 1),
  ano_desc: (a, b) => nullsLast(a.registrationYear, b.registrationYear, -1),
};

export function filterVehicles(
  rows: AdminVehicleRow[],
  f: { q?: string; estado?: string; publicacao?: string; vista?: string; desconto?: string; ordem?: string; pagina?: number },
  perPage = 25,
) {
  const vista = f.vista ?? "ativas";
  const list = rows.filter((v) => {
    if (vista === "ativas" && v.archivedAt) return false;
    if (vista === "arquivadas" && !v.archivedAt) return false;
    if (f.estado && ["disponivel", "reservado", "vendido"].includes(f.estado) && v.status !== f.estado) return false;
    if (f.publicacao === "publicadas" && !v.isPublished) return false;
    if (f.publicacao === "rascunho" && v.isPublished) return false;
    if (f.publicacao === "destaque" && !v.isFeatured) return false;
    if (f.desconto === "com" && !extra(v).activePromotion) return false;
    if (f.desconto === "sem" && extra(v).activePromotion) return false;
    if (f.desconto === "agendado" && !v.scheduledPromotion) return false;
    return matches([v.reference, v.brand, v.model, v.version, extra(v).vin, v.slug], f.q);
  });
  const order = ORDERS[f.ordem ?? "atualizadas"] ?? ORDERS.atualizadas;
  list.sort((a, b) => order(a, b) || a.id.localeCompare(b.id));
  return paginate(list, f.pagina ?? 1, perPage);
}

export function filterLeads(rows: LeadRow[], f: { q?: string; estado?: string; pagina?: number }, perPage = 25) {
  const counts: Record<string, number> = {};
  for (const l of rows) counts[l.status] = (counts[l.status] ?? 0) + 1;
  const list = rows.filter((l) => {
    if (f.estado === "pendentes") {
      if (!["novo", "em_contacto", "em_negociacao"].includes(l.status)) return false;
    } else if (f.estado && l.status !== f.estado) return false;
    return matches([l.name, l.email, l.phone, l.vehicleLabel, l.message], f.q);
  });
  return { ...paginate(list, f.pagina ?? 1, perPage), counts };
}
