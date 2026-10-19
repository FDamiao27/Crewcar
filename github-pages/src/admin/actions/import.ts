// Versão no navegador de src/app/admin/actions/import.ts.
import { MAX_IMPORT_ROWS, parseCsv, validateRows } from "@/lib/admin/csv";
import { ActionError, adminDb, check, fetchAll, logActivity, runAction, type ActionResult } from "../core";
import { insertVehicle, replaceChildren, updateVehicleRow } from "./vehicles";

export type ImportPreview = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: { line: number; reference: string; title: string; outcome: "novo" | "atualizar" | "duplicado" | "erro"; errors: string[] }[];
};

// Colunas do CSV → colunas da tabela vehicles atualizadas (apenas as presentes no ficheiro)
const COLUMN_FIELDS: Record<string, string[]> = {
  referencia: ["reference"], marca: ["brand"], modelo: ["model"], versao: ["version"], categoria: ["category"],
  estado_viatura: ["condition"], ano: ["registration_year"], data_primeira_matricula: ["first_registration_date"],
  quilometros: ["mileage_km"], combustivel: ["fuel"], caixa: ["transmission"], cilindrada: ["engine_cc"],
  potencia_cv: ["power_hp"], cor_exterior: ["exterior_color"], cor_interior: ["interior_color"], portas: ["doors"],
  lugares: ["seats"], preco_venda: ["price_cents"], preco_aquisicao: ["purchase_price_cents"], vin: ["vin"],
  estado: ["status", "reserved_at", "sold_at"], publicada: ["is_published", "published_at"], destaque: ["is_featured"],
  descricao_curta: ["short_description"], descricao: ["description"], garantia: ["warranty_info"], notas_internas: ["internal_notes"],
};

async function analyse(csv: string, mode: "ignorar" | "atualizar") {
  if (csv.length > 5_000_000) throw new ActionError("O ficheiro é demasiado grande (máximo 5 MB).");
  const parsed = parseCsv(csv);
  if (parsed.error) throw new ActionError(parsed.error);
  if (!parsed.headers.includes("referencia") || !parsed.headers.includes("marca") || !parsed.headers.includes("modelo"))
    throw new ActionError("O ficheiro tem de incluir pelo menos as colunas “referencia”, “marca” e “modelo”. Descarregue o modelo para ver o formato.");
  if (parsed.rows.length === 0) throw new ActionError("O ficheiro não contém linhas de dados.");
  if (parsed.rows.length > MAX_IMPORT_ROWS) throw new ActionError(`Importe no máximo ${MAX_IMPORT_ROWS} viaturas de cada vez.`);
  const existingRows = await fetchAll<{ id: string; reference: string; vin: string | null }>("vehicles", "id,reference,vin");
  const references = new Map(existingRows.map((r) => [r.reference.toLowerCase(), r.id]));
  const vins = new Map(existingRows.filter((r) => r.vin).map((r) => [r.vin!, r.reference.toLowerCase()]));
  return { rows: validateRows(parsed.rows, { references, vins }, mode), references };
}

function summarise(rows: ReturnType<typeof validateRows>): ImportPreview {
  return {
    total: rows.length,
    created: rows.filter((r) => r.outcome === "novo").length,
    updated: rows.filter((r) => r.outcome === "atualizar").length,
    skipped: rows.filter((r) => r.outcome === "duplicado").length,
    failed: rows.filter((r) => r.outcome === "erro").length,
    rows: rows.map(({ line, reference, title, outcome, errors }) => ({ line, reference, title, outcome, errors })),
  };
}

function rowError(err: unknown): string {
  const text = err && typeof err === "object" ? `${(err as { message?: string }).message ?? ""} ${(err as { details?: string }).details ?? ""}` : "";
  if (text.includes("vehicles_published_requires_price")) return "Não é possível publicar sem preço de venda.";
  if (text.includes("vehicles_vin_key")) return "VIN já utilizado por outra viatura.";
  if (err instanceof ActionError) return err.message;
  return "Não foi possível gravar esta linha.";
}

export async function previewImport(csv: string, mode: "ignorar" | "atualizar"): Promise<ActionResult<ImportPreview>> {
  return runAction("vehicles.manage", async () => {
    const { rows } = await analyse(csv, mode);
    return { ok: true, data: summarise(rows) };
  });
}

export async function commitImport(csv: string, mode: "ignorar" | "atualizar"): Promise<ActionResult<ImportPreview>> {
  return runAction("vehicles.manage", async (user) => {
    const { rows, references } = await analyse(csv, mode);
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      if (!row.data || (row.outcome !== "novo" && row.outcome !== "atualizar")) continue;
      const data = row.data;
      try {
        if (row.outcome === "novo") {
          await insertVehicle(data, user);
          created++;
          continue;
        }
        const id = references.get(data.reference.toLowerCase())!;
        const only = new Set([...row.present].flatMap((c) => COLUMN_FIELDS[c] ?? []));
        await updateVehicleRow(id, data, user, only);
        if (row.present.has("equipamento") || row.present.has("extras")) {
          const [equipment, links] = await Promise.all([
            check(await adminDb.from("vehicle_equipment").select("kind,label").eq("vehicle_id", id).order("position")) as { kind: string; label: string }[],
            check(await adminDb.from("vehicle_links").select("kind,label,url,is_public").eq("vehicle_id", id).order("position")) as {
              kind: "portal";
              label: string | null;
              url: string;
              is_public: boolean;
            }[],
          ]);
          await replaceChildren(id, {
            equipment: row.present.has("equipamento") ? data.equipment : equipment.filter((e) => e.kind === "equipamento").map((e) => e.label),
            extras: row.present.has("extras") ? data.extras : equipment.filter((e) => e.kind === "extra").map((e) => e.label),
            links: links.map((l) => ({ kind: l.kind, label: l.label, url: l.url, isPublic: l.is_public })),
          });
        }
        updated++;
      } catch (err) {
        row.outcome = "erro";
        row.errors.push(rowError(err));
      }
    }
    const summary = summarise(rows);
    await logActivity({ action: "importar", entityType: "viatura", summary: `Importou CSV: ${created} criada(s), ${updated} atualizada(s), ${summary.failed} com erro` });
    return {
      ok: true,
      message: `Importação concluída: ${created} criada(s), ${updated} atualizada(s), ${summary.skipped} ignorada(s), ${summary.failed} com erro.`,
      data: { ...summary, created, updated },
    };
  });
}
