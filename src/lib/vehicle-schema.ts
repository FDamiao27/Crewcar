// Validação dos dados de viaturas (partilhada entre o formulário e o servidor).
import { z } from "zod";
import { CATEGORIES, CONDITIONS, FUELS, LINK_KINDS, TRANSMISSIONS, VEHICLE_STATUSES } from "./constants";
import { parseEurosToCents } from "./format";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

const optInt = (min: number, max: number, msg: string) =>
  z
    .union([z.string(), z.number(), z.null()])
    .transform((v, ctx) => {
      if (v === null || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(/[\s.  ]/g, ""));
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: msg });
        return z.NEVER;
      }
      return n;
    });

const optEnum = <T extends Record<string, string>>(map: T, msg: string) =>
  z
    .string()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || v in map, msg) as unknown as z.ZodType<keyof T | null, string>;

export const money = (msg = "Valor inválido.") =>
  z.union([z.string(), z.number(), z.null()]).transform((v, ctx) => {
    if (v === null || v === "") return null;
    const cents = parseEurosToCents(v);
    if (cents === null || cents < 0 || cents > 2_000_000_000) {
      ctx.addIssue({ code: "custom", message: msg });
      return z.NEVER;
    }
    return cents;
  });

const currentYear = new Date().getFullYear();

export const vehicleLinkSchema = z.object({
  kind: z.enum(Object.keys(LINK_KINDS) as [keyof typeof LINK_KINDS]),
  label: optText(120),
  url: z
    .string()
    .trim()
    .max(2000)
    .regex(/^https?:\/\/[^\s]+$/i, "Endereço inválido (deve começar por https://)."),
  isPublic: z.boolean(),
});

export const vehicleSchema = z
  .object({
    brand: z.string().trim().min(1, "Indique a marca.").max(60),
    model: z.string().trim().min(1, "Indique o modelo.").max(80),
    version: optText(120),
    category: optEnum(CATEGORIES, "Categoria inválida."),
    reference: z
      .string()
      .trim()
      .min(1, "Indique a referência de stock.")
      .max(40)
      .regex(/^[\p{L}\d][\p{L}\d\s/_.-]*$/u, "Use apenas letras, números, espaços, /, _, . e -."),
    registrationYear: optInt(1900, currentYear + 1, `Ano entre 1900 e ${currentYear + 1}.`),
    firstRegistrationDate: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Data inválida."),
    mileageKm: optInt(0, 5_000_000, "Quilometragem inválida."),
    fuel: optEnum(FUELS, "Combustível inválido."),
    transmission: optEnum(TRANSMISSIONS, "Caixa inválida."),
    engineCc: optInt(1, 20000, "Cilindrada entre 1 e 20 000 cm³."),
    powerHp: optInt(1, 3000, "Potência entre 1 e 3000 cv."),
    exteriorColor: optText(60),
    interiorColor: optText(60),
    doors: optInt(1, 9, "Número de portas entre 1 e 9."),
    seats: optInt(1, 60, "Número de lugares entre 1 e 60."),
    condition: optEnum(CONDITIONS, "Estado inválido."),
    vin: z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || /^[A-HJ-NPR-Z0-9]{17}$/.test(v), "O VIN deve ter 17 caracteres (sem I, O ou Q)."),

    purchasePrice: money("Preço de aquisição inválido."),
    price: money("Preço de venda inválido."),

    shortDescription: optText(300),
    description: optText(20000),
    warrantyInfo: optText(2000),
    warrantyVerified: z.boolean(),
    commercialInfo: optText(2000),
    internalNotes: optText(10000),
    videoUrl: z
      .string()
      .trim()
      .max(2000)
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || /^https?:\/\/[^\s]+$/i.test(v), "Endereço de vídeo inválido."),

    equipment: z.array(z.string().trim().min(1).max(150)).max(300),
    extras: z.array(z.string().trim().min(1).max(150)).max(300),
    links: z.array(vehicleLinkSchema).max(20),

    status: z.enum(Object.keys(VEHICLE_STATUSES) as [keyof typeof VEHICLE_STATUSES]),
    isPublished: z.boolean(),
    isFeatured: z.boolean(),
    seoTitle: optText(120),
    seoDescription: optText(300),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(140)
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v), "Use apenas letras minúsculas, números e hífenes."),
  })
  .superRefine((v, ctx) => {
    if (v.isPublished && (!v.price || v.price <= 0))
      ctx.addIssue({ code: "custom", path: ["price"], message: "Indique o preço de venda antes de publicar." });
    if (v.firstRegistrationDate && v.registrationYear && Number(v.firstRegistrationDate.slice(0, 4)) !== v.registrationYear)
      ctx.addIssue({
        code: "custom",
        path: ["firstRegistrationDate"],
        message: "A data da primeira matrícula não corresponde ao ano de matrícula.",
      });
    if (v.firstRegistrationDate && new Date(v.firstRegistrationDate) > new Date())
      ctx.addIssue({ code: "custom", path: ["firstRegistrationDate"], message: "A data não pode ser futura." });
  });

export type VehicleInput = z.input<typeof vehicleSchema>;
export type VehicleData = z.output<typeof vehicleSchema>;

/** Estado vazio do formulário (todos os campos como texto editável). */
export type VehicleFormState = {
  brand: string;
  model: string;
  version: string;
  category: string;
  reference: string;
  registrationYear: string;
  firstRegistrationDate: string;
  mileageKm: string;
  fuel: string;
  transmission: string;
  engineCc: string;
  powerHp: string;
  exteriorColor: string;
  interiorColor: string;
  doors: string;
  seats: string;
  condition: string;
  vin: string;
  purchasePrice: string;
  price: string;
  shortDescription: string;
  description: string;
  warrantyInfo: string;
  warrantyVerified: boolean;
  commercialInfo: string;
  internalNotes: string;
  videoUrl: string;
  equipment: string[];
  extras: string[];
  links: { kind: keyof typeof LINK_KINDS; label: string; url: string; isPublic: boolean }[];
  status: keyof typeof VEHICLE_STATUSES;
  isPublished: boolean;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  slug: string;
};

export const EMPTY_VEHICLE_FORM: VehicleFormState = {
  brand: "",
  model: "",
  version: "",
  category: "",
  reference: "",
  registrationYear: "",
  firstRegistrationDate: "",
  mileageKm: "",
  fuel: "",
  transmission: "",
  engineCc: "",
  powerHp: "",
  exteriorColor: "",
  interiorColor: "",
  doors: "",
  seats: "",
  condition: "usado",
  vin: "",
  purchasePrice: "",
  price: "",
  shortDescription: "",
  description: "",
  warrantyInfo: "",
  warrantyVerified: false,
  commercialInfo: "",
  internalNotes: "",
  videoUrl: "",
  equipment: [],
  extras: [],
  links: [],
  status: "disponivel",
  isPublished: false,
  isFeatured: false,
  seoTitle: "",
  seoDescription: "",
  slug: "",
};

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

export function buildVehicleSlug(v: { brand: string; model: string; version?: string | null; registrationYear?: number | null }): string {
  return slugify([v.brand, v.model, v.version, v.registrationYear].filter(Boolean).join(" ")) || "viatura";
}

/** Converte erros zod em { campo: mensagem }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const promotionSchema = z
  .object({
    discountType: z.enum(["valor", "percentagem", "preco_final"]),
    value: z.string().trim().min(1, "Indique o valor."),
    label: optText(80),
    startsAt: z.string().trim(), // datetime-local (hora de Lisboa) ou vazio = agora
    endsAt: z.string().trim(),
  });
export type PromotionInput = z.input<typeof promotionSchema>;
