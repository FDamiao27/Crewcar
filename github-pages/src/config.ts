// Ligação ao Supabase do showroom estático.
// A chave "publishable" é pública por natureza (é usada no navegador): a proteção dos dados
// é garantida pelas permissões e políticas da base de dados (ver db/migrations/0004_public_api.sql).
// Valores definidos em vite.config.mts (projeto Supabase da CREW CAR).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const STORAGE_BUCKET: string = import.meta.env.VITE_STORAGE_BUCKET;

/** Caminho base do site (ex.: /Crewcar/ no GitHub Pages). */
export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

export function withBase(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

export function absoluteUrl(path: string): string {
  return `${window.location.origin}${withBase(path)}`;
}
