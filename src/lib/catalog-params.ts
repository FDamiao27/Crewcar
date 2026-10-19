// Conversão entre os parâmetros do URL do catálogo e os filtros (partilhado servidor/cliente).
import { CATEGORIES, FUELS, TRANSMISSIONS } from "./constants";

export type CatalogParams = {
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

type Raw = Record<string, string | string[] | undefined>;

function str(raw: Raw, key: string, max = 80): string | undefined {
  const v = raw[key];
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s.slice(0, max) : undefined;
}

function int(raw: Raw, key: string, min: number, max: number): number | undefined {
  const s = str(raw, key, 12);
  if (!s) return undefined;
  const n = Number(s.replace(/[\s.]/g, ""));
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

export const SORT_KEYS = ["recentes", "preco_asc", "preco_desc", "ano_desc", "ano_asc", "km_asc", "km_desc"];

export function parseCatalogParams(raw: Raw): CatalogParams {
  const combustivel = str(raw, "combustivel");
  const caixa = str(raw, "caixa");
  const categoria = str(raw, "categoria");
  const ordem = str(raw, "ordem");
  return {
    q: str(raw, "q", 100),
    marca: str(raw, "marca", 60),
    modelo: str(raw, "modelo", 80),
    precoMin: int(raw, "precoMin", 0, 10_000_000),
    precoMax: int(raw, "precoMax", 0, 10_000_000),
    anoMin: int(raw, "anoMin", 1900, 2100),
    anoMax: int(raw, "anoMax", 1900, 2100),
    kmMax: int(raw, "kmMax", 0, 5_000_000),
    combustivel: combustivel && combustivel in FUELS ? combustivel : undefined,
    caixa: caixa && caixa in TRANSMISSIONS ? caixa : undefined,
    categoria: categoria && categoria in CATEGORIES ? categoria : undefined,
    ordem: ordem && SORT_KEYS.includes(ordem) ? ordem : undefined,
    pagina: int(raw, "pagina", 1, 10_000),
  };
}

export function catalogHref(params: CatalogParams, overrides: Partial<CatalogParams> = {}): string {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "pagina" && v === 1) continue;
    if (k === "ordem" && v === "recentes") continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `/viaturas?${s}` : "/viaturas";
}

export function activeFilterCount(p: CatalogParams): number {
  return (["q", "marca", "modelo", "precoMin", "precoMax", "anoMin", "anoMax", "kmMax", "combustivel", "caixa", "categoria"] as const).filter(
    (k) => p[k] !== undefined,
  ).length;
}
