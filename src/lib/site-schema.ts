// Definições e conteúdos editáveis no back office: tipos, valores por omissão e validação.
// Partilhado entre servidor e cliente (sem dependências de servidor).
import { z } from "zod";
import { mediaUrl } from "./media-base";

const text = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres.`);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Indique um endereço começado por https://");
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (formato #RRGGBB).");

export const assetSchema = z
  .object({
    key: z.string().regex(/^site\/[a-z0-9-]+$/),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    variants: z.array(z.number().int().positive()).min(1),
  })
  .nullable();
export type Asset = z.infer<typeof assetSchema>;

export const DEFAULT_COLORS = {
  ink: "#0B0B0C",
  ink2: "#111214",
  graphite: "#202124",
  metal: "#A3A5A8",
  soft: "#F4F4F2",
  white: "#FFFFFF",
} as const;

export const TIMEZONES = {
  "Europe/Lisbon": "Portugal continental (Europe/Lisbon)",
  "Atlantic/Madeira": "Madeira (Atlantic/Madeira)",
  "Atlantic/Azores": "Açores (Atlantic/Azores)",
} as const;

export const settingsSchema = z.object({
  brandName: text(60).min(1, "Indique o nome da marca."),
  tagline: text(140),
  logo: assetSchema,
  favicon: assetSchema,
  appearance: z.object({
    colors: z.object({
      ink: hexColor,
      ink2: hexColor,
      graphite: hexColor,
      metal: hexColor,
      soft: hexColor,
      white: hexColor,
    }),
    font: z.enum(["inter", "manrope"]),
  }),
  contact: z.object({
    phone: text(30).refine((v) => v === "" || /^[+\d][\d\s().-]{5,}$/.test(v), "Telefone inválido."),
    phoneNote: text(120),
    email: text(254).refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "E-mail inválido."),
    whatsapp: text(30).refine((v) => v === "" || /^\+?\d[\d\s]{7,}$/.test(v), "Número de WhatsApp inválido (inclua o indicativo, ex.: +351…)."),
    address: z.object({
      street: text(160),
      postalCode: text(20).refine((v) => v === "" || /^\d{4}-\d{3}$/.test(v), "Código postal no formato 0000-000."),
      city: text(80),
      country: text(60),
    }),
    mapUrl: optionalUrl,
    openingHours: text(500),
  }),
  social: z.object({
    facebook: optionalUrl,
    instagram: optionalUrl,
    youtube: optionalUrl,
    tiktok: optionalUrl,
    linkedin: optionalUrl,
  }),
  company: z.object({
    legalName: text(160),
    nif: text(20).refine((v) => v === "" || /^\d{9}$/.test(v.replace(/\s/g, "")), "O NIF deve ter 9 dígitos."),
    registeredOffice: text(250),
    licence: text(120),
    complaintsBook: z.boolean(),
  }),
  regional: z.object({
    currency: z.enum(["EUR"]),
    language: z.enum(["pt-PT"]),
    timezone: z.enum(Object.keys(TIMEZONES) as [keyof typeof TIMEZONES]),
    dateFormat: z.enum(["DD/MM/AAAA"]),
  }),
  cookies: z.object({
    bannerEnabled: z.boolean(),
    message: text(400),
  }),
  analytics: z.object({
    provider: z.enum(["none", "plausible", "ga4"]),
    plausibleDomain: text(120).refine((v) => v === "" || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v), "Domínio inválido."),
    ga4Id: text(20).refine((v) => v === "" || /^G-[A-Z0-9]{4,}$/.test(v), "ID do Google Analytics inválido (G-XXXXXXX)."),
  }),
  publishing: z.object({
    perPage: z.number().int().min(6).max(48),
    showReserved: z.boolean(),
    keepSoldPages: z.boolean(),
    similarCount: z.number().int().min(0).max(8),
    whatsappMessage: text(300),
    allowIndexing: z.boolean(),
  }),
});
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  brandName: "CREW CAR",
  tagline: "",
  logo: null,
  favicon: null,
  appearance: { colors: { ...DEFAULT_COLORS }, font: "inter" },
  contact: {
    phone: "",
    phoneNote: "",
    email: "",
    whatsapp: "",
    address: { street: "", postalCode: "", city: "", country: "Portugal" },
    mapUrl: "",
    openingHours: "",
  },
  social: { facebook: "", instagram: "", youtube: "", tiktok: "", linkedin: "" },
  company: { legalName: "", nif: "", registeredOffice: "", licence: "", complaintsBook: true },
  regional: { currency: "EUR", language: "pt-PT", timezone: "Europe/Lisbon", dateFormat: "DD/MM/AAAA" },
  cookies: {
    bannerEnabled: true,
    message:
      "Utilizamos cookies essenciais para o funcionamento do site. Com a sua autorização, utilizamos também cookies de análise para melhorar a experiência.",
  },
  analytics: { provider: "none", plausibleDomain: "", ga4Id: "" },
  publishing: {
    perPage: 12,
    showReserved: true,
    keepSoldPages: true,
    similarCount: 4,
    whatsappMessage: "Olá! Tenho interesse nesta viatura:",
    allowIndexing: true,
  },
};

const advantageSchema = z.object({
  title: text(80).min(1, "Indique o título."),
  text: text(300),
  icon: z.enum(["shield", "check", "key", "wrench", "handshake", "file", "star", "clock"]),
});
const faqSchema = z.object({
  question: text(200).min(1, "Indique a pergunta."),
  answer: text(2000).min(1, "Indique a resposta."),
});
const bannerSchema = z.object({
  id: z.string().max(40),
  text: text(200).min(1, "Indique o texto do banner."),
  linkLabel: text(40),
  linkUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^(https?:\/\/|\/)[^\s]*$/i.test(v), "Ligação inválida (use /viaturas ou https://…)."),
  active: z.boolean(),
  startsAt: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  endsAt: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
});

export const ADVANTAGE_ICONS = {
  shield: "Escudo",
  check: "Visto",
  key: "Chave",
  wrench: "Ferramenta",
  handshake: "Aperto de mão",
  file: "Documento",
  star: "Estrela",
  clock: "Relógio",
} as const;

export const contentSchema = z.object({
  hero: z.object({
    eyebrow: text(60),
    title: text(120).min(1, "Indique o título principal."),
    subtitle: text(300),
    primaryCta: text(40).min(1),
    secondaryCta: text(40).min(1),
    image: assetSchema,
    overlay: z.number().int().min(0).max(90),
  }),
  home: z.object({
    featuredTitle: text(80),
    featuredSubtitle: text(200),
    latestTitle: text(80),
    latestSubtitle: text(200),
    showLatest: z.boolean(),
    showAbout: z.boolean(),
    showAdvantages: z.boolean(),
    showFaq: z.boolean(),
    showContacts: z.boolean(),
  }),
  about: z.object({
    title: text(80).min(1),
    lead: text(400),
    body: text(10000),
  }),
  advantages: z.object({
    title: text(80),
    items: z.array(advantageSchema).max(12),
  }),
  faq: z.object({
    title: text(80),
    items: z.array(faqSchema).max(40),
  }),
  banners: z.array(bannerSchema).max(10),
  footer: z.object({
    text: text(300),
  }),
  seo: z.object({
    title: text(70),
    description: text(170),
    ogImage: assetSchema,
  }),
});
export type Content = z.infer<typeof contentSchema>;

export const DEFAULT_CONTENT: Content = {
  hero: {
    eyebrow: "Stand automóvel",
    title: "ENCONTRA O TEU PRÓXIMO DESTINO.",
    subtitle: "Uma seleção de automóveis escolhidos ao detalhe. Descobre a tua próxima viatura com a Crew Car.",
    primaryCta: "Explorar viaturas",
    secondaryCta: "Falar com a Crew Car",
    image: null,
    overlay: 55,
  },
  home: {
    featuredTitle: "Em destaque",
    featuredSubtitle: "Viaturas selecionadas pela equipa Crew Car.",
    latestTitle: "Chegadas recentes",
    latestSubtitle: "As últimas viaturas a entrar no nosso stock.",
    showLatest: true,
    showAbout: true,
    showAdvantages: true,
    showFaq: true,
    showContacts: true,
  },
  about: {
    title: "O Stand",
    lead: "Uma seleção de automóveis escolhidos ao detalhe. Consulte o catálogo, compare as viaturas e fale connosco para saber mais.",
    body: "",
  },
  advantages: { title: "Porquê a Crew Car", items: [] },
  faq: { title: "Perguntas frequentes", items: [] },
  banners: [],
  footer: { text: "" },
  seo: {
    title: "CREW CAR — Stand automóvel",
    description: "Uma seleção de automóveis escolhidos ao detalhe. Descobre a tua próxima viatura com a Crew Car.",
    ogImage: null,
  },
};

type Plain = Record<string, unknown>;
function isPlain(v: unknown): v is Plain {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Junta valores guardados com os valores por omissão (tolerante a campos novos ou em falta). */
export function mergeDefaults<T>(defaults: T, stored: unknown): T {
  if (!isPlain(defaults) || !isPlain(stored)) {
    if (stored === undefined) return defaults;
    if (Array.isArray(defaults)) return (Array.isArray(stored) ? stored : defaults) as T;
    if (defaults === null) return (stored ?? null) as T;
    return (typeof stored === typeof defaults ? stored : defaults) as T;
  }
  const out: Plain = {};
  for (const [k, v] of Object.entries(defaults)) out[k] = mergeDefaults(v, stored[k]);
  return out as T;
}

export function parseSettings(stored: unknown): Settings {
  const merged = mergeDefaults(DEFAULT_SETTINGS, stored);
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export function parseContent(stored: unknown): Content {
  const merged = mergeDefaults(DEFAULT_CONTENT, stored);
  const parsed = contentSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_CONTENT;
}

export function activeBanners(content: Content, today: string): Content["banners"] {
  return content.banners.filter(
    (b) => b.active && (!b.startsAt || b.startsAt <= today) && (!b.endsAt || b.endsAt >= today),
  );
}

export function whatsappDigits(n: string): string {
  const digits = n.replace(/\D/g, "");
  return digits.length === 9 ? `351${digits}` : digits;
}

export function assetUrl(asset: NonNullable<Asset>, width?: number, ext = "webp"): string {
  const w = width ? asset.variants.reduce((best, v) => (v >= width && v < best ? v : best), Math.max(...asset.variants)) : Math.max(...asset.variants);
  return mediaUrl(`${asset.key}-${w}.${ext}`);
}
