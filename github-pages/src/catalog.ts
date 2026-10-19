import type { CatalogParams } from "@/lib/catalog-params";
import type { CatalogFacets, VehicleCard, VehicleDetail } from "@/lib/queries/public";

// Pesquisa, filtros e ordenação do catálogo no navegador (mesmas regras do site Next.js).

/** Equivalente à função f_norm() da base de dados: minúsculas e sem acentos. */
export function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const time = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : null);

type Cmp = (a: VehicleCard, b: VehicleCard) => number;

/** Ordenação com valores em falta no fim, e desempate pela data de publicação mais recente. */
function by(get: (v: VehicleCard) => number | null, dir: 1 | -1): Cmp {
  return (a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === null && y === null) return recent(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * dir || recent(a, b);
  };
}

const recent: Cmp = (a, b) => (time(b.publishedAt) ?? 0) - (time(a.publishedAt) ?? 0);

const SORTS: Record<string, Cmp> = {
  recentes: recent,
  preco_asc: by((v) => v.pricing.finalPriceCents, 1),
  preco_desc: by((v) => v.pricing.finalPriceCents, -1),
  ano_desc: by((v) => v.registrationYear, -1),
  ano_asc: by((v) => v.registrationYear, 1),
  km_asc: by((v) => v.mileageKm, 1),
  km_desc: by((v) => v.mileageKm, -1),
};

export function searchCatalog(all: VehicleDetail[], p: CatalogParams, perPage: number, showReserved: boolean) {
  const statuses = showReserved ? ["disponivel", "reservado"] : ["disponivel"];
  const base = all.filter((v) => statuses.includes(v.status));
  const terms = (p.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 8).map(norm);

  const filtered = base.filter((v) => {
    if (terms.length) {
      const hay = norm([v.brand, v.model, v.version, v.reference, v.category, v.fuel, v.shortDescription, v.exteriorColor].filter(Boolean).join(" "));
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    const price = v.pricing.finalPriceCents;
    if (p.marca && norm(v.brand) !== norm(p.marca)) return false;
    if (p.modelo && norm(v.model) !== norm(p.modelo)) return false;
    if (p.precoMin !== undefined && (price === null || price < p.precoMin * 100)) return false;
    if (p.precoMax !== undefined && (price === null || price > p.precoMax * 100)) return false;
    if (p.anoMin !== undefined && (v.registrationYear === null || v.registrationYear < p.anoMin)) return false;
    if (p.anoMax !== undefined && (v.registrationYear === null || v.registrationYear > p.anoMax)) return false;
    if (p.kmMax !== undefined && (v.mileageKm === null || v.mileageKm > p.kmMax)) return false;
    if (p.combustivel && v.fuel !== p.combustivel) return false;
    if (p.caixa && v.transmission !== p.caixa) return false;
    if (p.categoria && v.category !== p.categoria) return false;
    return true;
  });

  filtered.sort(SORTS[p.ordem ?? "recentes"] ?? recent);
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, p.pagina ?? 1), pages);

  const brandGroups = new Map<string, { value: string; count: number }>();
  for (const v of base) {
    const k = norm(v.brand);
    const g = brandGroups.get(k);
    if (g) {
      g.count++;
      if (v.brand < g.value) g.value = v.brand;
    } else brandGroups.set(k, { value: v.brand, count: 1 });
  }
  const modelGroups = new Map<string, { value: string; count: number }>();
  if (p.marca) {
    for (const v of base.filter((x) => norm(x.brand) === norm(p.marca))) {
      const k = norm(v.model);
      const g = modelGroups.get(k);
      if (g) g.count++;
      else modelGroups.set(k, { value: v.model, count: 1 });
    }
  }
  const years = base.map((v) => v.registrationYear).filter((y): y is number => y !== null);
  const prices = base.map((v) => v.pricing.finalPriceCents).filter((y): y is number => y !== null);
  const distinct = (list: (string | null)[]) => [...new Set(list.filter((x): x is string => !!x))];

  const facets: CatalogFacets = {
    brands: [...brandGroups.values()].sort((a, b) => a.value.localeCompare(b.value, "pt")),
    models: [...modelGroups.values()].sort((a, b) => a.value.localeCompare(b.value, "pt")),
    fuels: distinct(base.map((v) => v.fuel)),
    transmissions: distinct(base.map((v) => v.transmission)),
    categories: distinct(base.map((v) => v.category)),
    years: { min: years.length ? Math.min(...years) : null, max: years.length ? Math.max(...years) : null },
    prices: { min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null },
  };

  return { items: filtered.slice((page - 1) * perPage, page * perPage), total, page, pages, facets };
}

export function featuredVehicles(all: VehicleDetail[], limit = 6): VehicleDetail[] {
  return all
    .filter((v) => v.isFeatured && v.status !== "vendido")
    .sort((a, b) => Number(b.status === "disponivel") - Number(a.status === "disponivel") || recent(a, b))
    .slice(0, limit);
}

export function latestVehicles(all: VehicleDetail[], limit = 6): VehicleDetail[] {
  return all
    .filter((v) => v.status === "disponivel" && !v.isFeatured)
    .sort(recent)
    .slice(0, limit);
}

export function similarVehicles(all: VehicleDetail[], v: VehicleDetail, limit: number): VehicleDetail[] {
  if (limit <= 0) return [];
  const price = v.pricing.finalPriceCents ?? v.priceCents ?? 0;
  const score = (x: VehicleDetail) => Number(norm(x.brand) === norm(v.brand)) + Number(x.category === v.category);
  return all
    .filter(
      (x) =>
        x.id !== v.id &&
        x.status !== "vendido" &&
        (x.category === v.category ||
          norm(x.brand) === norm(v.brand) ||
          ((x.priceCents ?? 0) >= price * 0.75 && (x.priceCents ?? 0) <= price * 1.25)),
    )
    .sort((a, b) => score(b) - score(a) || Math.abs((a.priceCents ?? 0) - price) - Math.abs((b.priceCents ?? 0) - price))
    .slice(0, limit);
}
