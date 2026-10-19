// Versão no navegador de src/app/admin/actions/leads.ts.
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants";
import { ActionError, adminDb, check, logActivity, runAction, type ActionResult } from "../core";

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export async function setLeadStatus(id: string, status: LeadStatus): Promise<ActionResult> {
  return runAction("leads.manage", async (user) => {
    if (!isUuid(id) || !(status in LEAD_STATUSES)) throw new ActionError("Pedido inválido.");
    const lead = check(await adminDb.from("leads").select("status").eq("id", id).maybeSingle()) as { status: LeadStatus } | null;
    if (!lead) throw new ActionError("O contacto já não existe.");
    if (lead.status !== status) {
      check(await adminDb.from("leads").update({ status }).eq("id", id));
      check(await adminDb.from("lead_activity").insert({ lead_id: id, kind: "estado", from_status: lead.status, to_status: status, actor_id: user.id }));
    }
    await logActivity({ action: "estado", entityType: "contacto", entityId: id, summary: `Alterou o estado de um contacto para “${LEAD_STATUSES[status]}”` });
    return { ok: true, message: `Estado alterado para “${LEAD_STATUSES[status]}”.` };
  });
}

export async function addLeadNote(id: string, body: string): Promise<ActionResult> {
  return runAction("leads.manage", async (user) => {
    if (!isUuid(id)) throw new ActionError("Pedido inválido.");
    const text = body.trim();
    if (!text) throw new ActionError("Escreva a nota.", { body: "Escreva a nota." });
    if (text.length > 5000) throw new ActionError("A nota é demasiado longa (máximo 5000 caracteres).");
    const rows = check(await adminDb.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", id).select("id")) as unknown[];
    if (!rows.length) throw new ActionError("O contacto já não existe.");
    check(await adminDb.from("lead_activity").insert({ lead_id: id, kind: "nota", body: text, actor_id: user.id }));
    return { ok: true, message: "Nota adicionada." };
  });
}

export async function deleteLead(id: string): Promise<ActionResult> {
  return runAction("leads.delete", async () => {
    if (!isUuid(id)) throw new ActionError("Pedido inválido.");
    const rows = check(await adminDb.from("leads").delete().eq("id", id).select("id")) as unknown[];
    if (!rows.length) throw new ActionError("O contacto já não existe.");
    // O registo de atividade não guarda dados pessoais do contacto eliminado
    await logActivity({ action: "eliminar", entityType: "contacto", summary: "Eliminou um contacto (dados pessoais removidos)" });
    return { ok: true, message: "Contacto e respetivos dados pessoais eliminados." };
  });
}
