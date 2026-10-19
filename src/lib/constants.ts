// Vocabulário de domínio partilhado entre servidor e cliente (sem dependências de servidor).

export const FUELS = {
  gasolina: "Gasolina",
  gasoleo: "Gasóleo",
  hibrido: "Híbrido",
  hibrido_plugin: "Híbrido plug-in",
  eletrico: "Elétrico",
  gpl: "GPL",
  gnv: "GNV",
  hidrogenio: "Hidrogénio",
  outro: "Outro",
} as const;
export type Fuel = keyof typeof FUELS;

export const TRANSMISSIONS = {
  manual: "Manual",
  automatica: "Automática",
  semiautomatica: "Semiautomática",
} as const;
export type Transmission = keyof typeof TRANSMISSIONS;

export const CATEGORIES = {
  citadino: "Citadino",
  utilitario: "Utilitário",
  berlina: "Berlina",
  carrinha: "Carrinha",
  suv: "SUV",
  coupe: "Coupé",
  cabrio: "Cabrio",
  monovolume: "Monovolume",
  comercial: "Comercial",
  pickup: "Pick-up",
  desportivo: "Desportivo",
  classico: "Clássico",
  outro: "Outro",
} as const;
export type Category = keyof typeof CATEGORIES;

export const CONDITIONS = {
  novo: "Novo",
  seminovo: "Seminovo",
  usado: "Usado",
  servico: "Viatura de serviço",
  classico: "Clássico",
} as const;
export type Condition = keyof typeof CONDITIONS;

export const VEHICLE_STATUSES = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
} as const;
export type VehicleStatus = keyof typeof VEHICLE_STATUSES;

export const LEAD_STATUSES = {
  novo: "Novo",
  em_contacto: "Em contacto",
  em_negociacao: "Em negociação",
  convertido: "Convertido",
  perdido: "Perdido",
} as const;
export type LeadStatus = keyof typeof LEAD_STATUSES;
export const PENDING_LEAD_STATUSES: LeadStatus[] = ["novo", "em_contacto", "em_negociacao"];

export const LINK_KINDS = {
  portal: "Anúncio em portal automóvel",
  video: "Vídeo",
  historico: "Relatório de histórico",
  outro: "Outra ligação",
} as const;
export type LinkKind = keyof typeof LINK_KINDS;

export const DISCOUNT_TYPES = {
  valor: "Desconto em valor (€)",
  percentagem: "Desconto em percentagem (%)",
  preco_final: "Preço final promocional (€)",
} as const;
export type DiscountType = keyof typeof DISCOUNT_TYPES;

export const LEAD_SUBJECTS = ["Pedido de informação", "Agendar visita", "Proposta de retoma", "Outro assunto"] as const;

export const LEAD_SOURCES: Record<string, string> = {
  pagina_contactos: "Página de contactos",
  pagina_viatura: "Página da viatura",
  pagina_inicial: "Página inicial",
  manual: "Registo manual",
};

export const PUBLIC_PAGES = {
  privacidade: "Política de privacidade",
  cookies: "Política de cookies",
  "informacao-legal": "Informação legal",
} as const;
export type PublicPageSlug = keyof typeof PUBLIC_PAGES;

export function label<T extends Record<string, string>>(map: T, key: string | null | undefined): string | null {
  if (!key) return null;
  return (map as Record<string, string>)[key] ?? null;
}
