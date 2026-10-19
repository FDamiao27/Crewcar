import "server-only";
import Papa from "papaparse";
import { CATEGORIES, CONDITIONS, FUELS, TRANSMISSIONS, VEHICLE_STATUSES } from "@/lib/constants";
import { centsToInput } from "@/lib/format";
import { EMPTY_VEHICLE_FORM, fieldErrors, vehicleSchema, type VehicleData, type VehicleFormState } from "@/lib/vehicle-schema";

// Importação e exportação de stock em CSV (separador ";" e UTF-8 com BOM, compatível com Excel em português).

export const CSV_COLUMNS = [
  ["referencia", "Referência de stock"],
  ["marca", "Marca"],
  ["modelo", "Modelo"],
  ["versao", "Versão"],
  ["categoria", "Categoria"],
  ["estado_viatura", "Estado da viatura (novo, seminovo, usado…)"],
  ["ano", "Ano de matrícula"],
  ["data_primeira_matricula", "Data da 1.ª matrícula (AAAA-MM-DD ou DD/MM/AAAA)"],
  ["quilometros", "Quilometragem"],
  ["combustivel", "Combustível"],
  ["caixa", "Caixa de velocidades"],
  ["cilindrada", "Cilindrada (cm³)"],
  ["potencia_cv", "Potência (cv)"],
  ["cor_exterior", "Cor exterior"],
  ["cor_interior", "Cor interior"],
  ["portas", "Portas"],
  ["lugares", "Lugares"],
  ["preco_venda", "Preço de venda (€)"],
  ["preco_aquisicao", "Preço de aquisição (€) — privado"],
  ["vin", "VIN — privado"],
  ["estado", "Estado comercial (disponivel, reservado, vendido)"],
  ["publicada", "Publicada (sim/não)"],
  ["destaque", "Destaque (sim/não)"],
  ["descricao_curta", "Descrição curta"],
  ["descricao", "Descrição completa"],
  ["equipamento", "Equipamento (separado por |)"],
  ["extras", "Extras (separados por |)"],
  ["garantia", "Garantia"],
  ["notas_internas", "Notas internas — privado"],
] as const;

const PRIVATE_COST_COLUMNS = new Set(["preco_aquisicao"]);

export type ExportVehicle = Record<string, unknown> & { equipment: string[]; extras: string[] };

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function buildCsv(rows: ExportVehicle[], opts: { includeCosts: boolean }): string {
  const cols = CSV_COLUMNS.filter(([k]) => opts.includeCosts || !PRIVATE_COST_COLUMNS.has(k));
  const data = rows.map((r) => {
    const map: Record<string, string> = {
      referencia: cell(r.reference),
      marca: cell(r.brand),
      modelo: cell(r.model),
      versao: cell(r.version),
      categoria: cell(r.category),
      estado_viatura: cell(r.condition),
      ano: cell(r.registrationYear),
      data_primeira_matricula: cell(r.firstRegistrationDate),
      quilometros: cell(r.mileageKm),
      combustivel: cell(r.fuel),
      caixa: cell(r.transmission),
      cilindrada: cell(r.engineCc),
      potencia_cv: cell(r.powerHp),
      cor_exterior: cell(r.exteriorColor),
      cor_interior: cell(r.interiorColor),
      portas: cell(r.doors),
      lugares: cell(r.seats),
      preco_venda: centsToInput(r.priceCents as number | null),
      preco_aquisicao: centsToInput(r.purchasePriceCents as number | null),
      vin: cell(r.vin),
      estado: cell(r.status),
      publicada: r.isPublished ? "sim" : "não",
      destaque: r.isFeatured ? "sim" : "não",
      descricao_curta: cell(r.shortDescription),
      descricao: cell(r.description),
      equipamento: r.equipment.join(" | "),
      extras: r.extras.join(" | "),
      garantia: cell(r.warrantyInfo),
      notas_internas: cell(r.internalNotes),
    };
    return cols.map(([k]) => {
      const value = map[k] ?? "";
      // Proteção contra injeção de fórmulas em folhas de cálculo
      return /^[=+\-@\t\r]/.test(value) && !/^-?\d/.test(value) ? `'${value}` : value;
    });
  });
  return "﻿" + Papa.unparse({ fields: cols.map(([k]) => k), data }, { delimiter: ";", newline: "\r\n" });
}

// ───────────────────────────── Importação ─────────────────────────────

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const HEADER_ALIASES: Record<string, string> = {
  ref: "referencia", referencia_de_stock: "referencia", reference: "referencia",
  brand: "marca", model: "modelo", version: "versao",
  ano_de_matricula: "ano", year: "ano", km: "quilometros", quilometragem: "quilometros", kms: "quilometros",
  caixa_de_velocidades: "caixa", transmissao: "caixa", potencia: "potencia_cv", cv: "potencia_cv",
  preco: "preco_venda", preco_de_venda: "preco_venda", price: "preco_venda",
  preco_de_aquisicao: "preco_aquisicao", custo: "preco_aquisicao",
  estado_comercial: "estado", publicado: "publicada", destacada: "destaque",
};

function mapEnum(map: Record<string, string>, value: string): string {
  if (!value) return "";
  const n = norm(value);
  for (const [k, l] of Object.entries(map)) if (norm(k) === n || norm(l) === n) return k;
  if (n === "diesel") return "gasoleo";
  if (n === "automatico") return "automatica";
  return value; // mantém o valor para que a validação indique o erro
}

function bool(value: string): boolean {
  return ["sim", "s", "yes", "true", "1", "x"].includes(norm(value));
}

function dateValue(value: string): string {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value.trim());
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return value.trim();
}

export type ImportRow = {
  line: number;
  reference: string;
  title: string;
  outcome: "novo" | "atualizar" | "duplicado" | "erro";
  errors: string[];
  data?: VehicleData;
  present: Set<string>;
};

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[]; error?: string } {
  const clean = text.replace(/^﻿/, "");
  const result = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => {
      const n = norm(h);
      return HEADER_ALIASES[n] ?? n;
    },
  });
  if (!result.meta.fields?.length) return { headers: [], rows: [], error: "O ficheiro não tem cabeçalho." };
  const fatal = result.errors.find((e) => e.type === "Delimiter");
  if (fatal && result.data.length === 0) return { headers: [], rows: [], error: "Não foi possível identificar o separador do ficheiro." };
  return { headers: result.meta.fields, rows: result.data };
}

export function rowToForm(raw: Record<string, string>): { form: VehicleFormState; present: Set<string> } {
  const g = (k: string) => (raw[k] ?? "").toString().trim().replace(/^'(?=[=+\-@])/, "");
  const present = new Set(Object.keys(raw).filter((k) => raw[k] !== undefined));
  const list = (k: string) =>
    g(k)
      .split(/\s*[|\n]\s*/)
      .map((x) => x.trim())
      .filter(Boolean);
  return {
    present,
    form: {
      ...EMPTY_VEHICLE_FORM,
      reference: g("referencia"),
      brand: g("marca"),
      model: g("modelo"),
      version: g("versao"),
      category: mapEnum(CATEGORIES, g("categoria")),
      condition: mapEnum(CONDITIONS, g("estado_viatura")) || "usado",
      registrationYear: g("ano"),
      firstRegistrationDate: dateValue(g("data_primeira_matricula")),
      mileageKm: g("quilometros"),
      fuel: mapEnum(FUELS, g("combustivel")),
      transmission: mapEnum(TRANSMISSIONS, g("caixa")),
      engineCc: g("cilindrada"),
      powerHp: g("potencia_cv"),
      exteriorColor: g("cor_exterior"),
      interiorColor: g("cor_interior"),
      doors: g("portas"),
      seats: g("lugares"),
      price: g("preco_venda"),
      purchasePrice: g("preco_aquisicao"),
      vin: g("vin"),
      status: (mapEnum(VEHICLE_STATUSES, g("estado")) || "disponivel") as VehicleFormState["status"],
      isPublished: bool(g("publicada")),
      isFeatured: bool(g("destaque")),
      shortDescription: g("descricao_curta"),
      description: g("descricao"),
      equipment: list("equipamento"),
      extras: list("extras"),
      warrantyInfo: g("garantia"),
      internalNotes: g("notas_internas"),
    },
  };
}

export const MAX_IMPORT_ROWS = 1000;

export function validateRows(
  rows: Record<string, string>[],
  existing: { references: Map<string, string>; vins: Map<string, string> },
  mode: "ignorar" | "atualizar",
): ImportRow[] {
  const seenRefs = new Map<string, number>();
  const seenVins = new Map<string, number>();
  return rows.map((raw, i) => {
    const line = i + 2; // linha 1 = cabeçalho
    const { form, present } = rowToForm(raw);
    const title = [form.brand, form.model, form.version].filter(Boolean).join(" ");
    const parsed = vehicleSchema.safeParse(form);
    const errors: string[] = [];
    if (!parsed.success) for (const [k, m] of Object.entries(fieldErrors(parsed.error))) errors.push(`${k}: ${m}`);
    const refKey = form.reference.toLowerCase();
    if (refKey) {
      if (seenRefs.has(refKey)) errors.push(`Referência repetida no ficheiro (linha ${seenRefs.get(refKey)}).`);
      else seenRefs.set(refKey, line);
    }
    const vin = form.vin.toUpperCase();
    if (vin) {
      if (seenVins.has(vin)) errors.push(`VIN repetido no ficheiro (linha ${seenVins.get(vin)}).`);
      else seenVins.set(vin, line);
      const owner = existing.vins.get(vin);
      if (owner && owner !== refKey) errors.push(`O VIN já pertence à viatura ${owner.toUpperCase()}.`);
    }
    if (errors.length) return { line, reference: form.reference, title, outcome: "erro", errors, present };
    const exists = existing.references.has(refKey);
    return {
      line,
      reference: form.reference,
      title,
      outcome: exists ? (mode === "atualizar" ? "atualizar" : "duplicado") : "novo",
      errors: exists && mode === "ignorar" ? ["Já existe uma viatura com esta referência — será ignorada."] : [],
      data: parsed.success ? parsed.data : undefined,
      present,
    };
  });
}
