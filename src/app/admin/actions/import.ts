"use server";

import { logActivity } from "@/lib/activity";
import { ActionError, runAction, type ActionResult } from "@/lib/admin/action";
import { MAX_IMPORT_ROWS, parseCsv, validateRows } from "@/lib/admin/csv";
import { insertVehicle, replaceChildren, vehicleColumns } from "@/lib/admin/vehicles";
import { can } from "@/lib/auth/permissions";
import { pgConstraint, sql, type Tx } from "@/lib/db";

export type ImportPreview = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: { line: number; reference: string; title: string; outcome: "novo" | "atualizar" | "duplicado" | "erro"; errors: string[] }[];
};

const COLUMN_FIELDS: Record<string, string[]> = {
  referencia: ["reference"], marca: ["brand"], modelo: ["model"], versao: ["version"], categoria: ["category"],
  estado_viatura: ["condition"], ano: ["registrationYear"], data_primeira_matricula: ["firstRegistrationDate"],
  quilometros: ["mileageKm"], combustivel: ["fuel"], caixa: ["transmission"], cilindrada: ["engineCc"],
  potencia_cv: ["powerHp"], cor_exterior: ["exteriorColor"], cor_interior: ["interiorColor"], portas: ["doors"],
  lugares: ["seats"], preco_venda: ["priceCents"], preco_aquisicao: ["purchasePriceCents"], vin: ["vin"],
  estado: ["status"], publicada: ["isPublished"], destaque: ["isFeatured"], descricao_curta: ["shortDescription"],
  descricao: ["description"], garantia: ["warrantyInfo"], notas_internas: ["internalNotes"],
};

async function analyse(csv: string, mode: "ignorar" | "atualizar") {
  if (csv.length > 5_000_000) throw new ActionError("O ficheiro é demasiado grande (máximo 5 MB).");
  const parsed = parseCsv(csv);
  if (parsed.error) throw new ActionError(parsed.error);
  if (!parsed.headers.includes("referencia") || !parsed.headers.includes("marca") || !parsed.headers.includes("modelo"))
    throw new ActionError("O ficheiro tem de incluir pelo menos as colunas “referencia”, “marca” e “modelo”. Descarregue o modelo para ver o formato.");
  if (parsed.rows.length === 0) throw new ActionError("O ficheiro não contém linhas de dados.");
  if (parsed.rows.length > MAX_IMPORT_ROWS) throw new ActionError(`Importe no máximo ${MAX_IMPORT_ROWS} viaturas de cada vez.`);
  const existingRows = await sql<{ id: string; reference: string; vin: string | null }[]>`select id, reference, vin from vehicles`;
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

export async function previewImport(csv: string, mode: "ignorar" | "atualizar"): Promise<ActionResult<ImportPreview>> {
  return runAction("vehicles.manage", async () => {
    const { rows } = await analyse(csv, mode);
    return { ok: true, data: summarise(rows) };
  });
}

export async function commitImport(csv: string, mode: "ignorar" | "atualizar"): Promise<ActionResult<ImportPreview>> {
  return runAction("vehicles.manage", async (user) => {
    const { rows, references } = await analyse(csv, mode);
    const canSeeCosts = can(user.role, "costs.view");
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      if (!row.data || (row.outcome !== "novo" && row.outcome !== "atualizar")) continue;
      const data = row.data;
      try {
        await sql.begin(async (raw) => {
          const tx = raw as unknown as Tx;
          if (row.outcome === "novo") {
            await insertVehicle(tx, data, user.id, { canSeeCosts });
            created++;
            return;
          }
          const id = references.get(data.reference.toLowerCase())!;
          const all = vehicleColumns(data, { canSeeCosts }) as Record<string, unknown>;
          const allowed = new Set([...row.present].flatMap((c) => COLUMN_FIELDS[c] ?? []));
          const cols: Record<string, unknown> = { updatedBy: user.id };
          for (const [k, v] of Object.entries(all)) if (allowed.has(k)) cols[k] = v;
          await tx`update vehicles set ${tx(cols)} where id = ${id}`;
          if (row.present.has("equipamento") || row.present.has("extras")) {
            const [current] = await tx<{ equipment: string[]; extras: string[] }[]>`
              select coalesce(array(select label from vehicle_equipment where vehicle_id = ${id} and kind = 'equipamento' order by position), '{}') as equipment,
                     coalesce(array(select label from vehicle_equipment where vehicle_id = ${id} and kind = 'extra' order by position), '{}') as extras`;
            const links = await tx<{ kind: "portal"; label: string | null; url: string; isPublic: boolean }[]>`
              select kind, label, url, is_public from vehicle_links where vehicle_id = ${id} order by position`;
            await replaceChildren(tx, id, {
              equipment: row.present.has("equipamento") ? data.equipment : current.equipment,
              extras: row.present.has("extras") ? data.extras : current.extras,
              links,
            });
          }
          updated++;
        });
      } catch (err) {
        row.outcome = "erro";
        row.errors.push(
          pgConstraint(err) === "vehicles_published_requires_price"
            ? "Não é possível publicar sem preço de venda."
            : pgConstraint(err) === "vehicles_vin_key"
              ? "VIN já utilizado por outra viatura."
              : "Não foi possível gravar esta linha.",
        );
      }
    }
    const summary = summarise(rows);
    await logActivity({ actorId: user.id, action: "importar", entityType: "viatura", summary: `Importou CSV: ${created} criada(s), ${updated} atualizada(s), ${summary.failed} com erro` });
    return {
      ok: true,
      message: `Importação concluída: ${created} criada(s), ${updated} atualizada(s), ${summary.skipped} ignorada(s), ${summary.failed} com erro.`,
      data: { ...summary, created, updated },
    };
  });
}
