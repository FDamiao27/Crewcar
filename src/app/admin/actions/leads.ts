"use server";

import { logActivity } from "@/lib/activity";
import { ActionError, runAction, type ActionResult } from "@/lib/admin/action";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants";
import { sql } from "@/lib/db";

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export async function setLeadStatus(id: string, status: LeadStatus): Promise<ActionResult> {
  return runAction("leads.manage", async (user) => {
    if (!isUuid(id) || !(status in LEAD_STATUSES)) throw new ActionError("Pedido inválido.");
    await sql.begin(async (tx) => {
      const [lead] = await tx<{ status: LeadStatus; name: string }[]>`select status, name from leads where id = ${id} for update`;
      if (!lead) throw new ActionError("O contacto já não existe.");
      if (lead.status === status) return;
      await tx`update leads set status = ${status} where id = ${id}`;
      await tx`insert into lead_activity (lead_id, kind, from_status, to_status, actor_id) values (${id}, 'estado', ${lead.status}, ${status}, ${user.id})`;
    });
    await logActivity({ actorId: user.id, action: "estado", entityType: "contacto", entityId: id, summary: `Alterou o estado de um contacto para “${LEAD_STATUSES[status]}”` });
    return { ok: true, message: `Estado alterado para “${LEAD_STATUSES[status]}”.` };
  });
}

export async function addLeadNote(id: string, body: string): Promise<ActionResult> {
  return runAction("leads.manage", async (user) => {
    if (!isUuid(id)) throw new ActionError("Pedido inválido.");
    const text = body.trim();
    if (!text) throw new ActionError("Escreva a nota.", { body: "Escreva a nota." });
    if (text.length > 5000) throw new ActionError("A nota é demasiado longa (máximo 5000 caracteres).");
    const r = await sql`insert into lead_activity (lead_id, kind, body, actor_id) select ${id}, 'nota', ${text}, ${user.id} where exists (select 1 from leads where id = ${id})`;
    if (r.count === 0) throw new ActionError("O contacto já não existe.");
    await sql`update leads set updated_at = now() where id = ${id}`;
    return { ok: true, message: "Nota adicionada." };
  });
}

export async function deleteLead(id: string): Promise<ActionResult> {
  return runAction("leads.delete", async (user) => {
    if (!isUuid(id)) throw new ActionError("Pedido inválido.");
    const [l] = await sql<{ name: string }[]>`delete from leads where id = ${id} returning name`;
    if (!l) throw new ActionError("O contacto já não existe.");
    // O registo de atividade não guarda dados pessoais do contacto eliminado
    await logActivity({ actorId: user.id, action: "eliminar", entityType: "contacto", summary: "Eliminou um contacto (dados pessoais removidos)" });
    return { ok: true, message: "Contacto e respetivos dados pessoais eliminados." };
  });
}
