import "server-only";
import { sql } from "@/lib/db";

export async function logActivity(entry: {
  actorId: string | null;
  action: string;
  entityType: "viatura" | "contacto" | "conteudo" | "definicoes" | "pagina" | "utilizador" | "sessao" | "promocao";
  entityId?: string | null;
  summary: string;
}): Promise<void> {
  await sql`
    insert into activity_log (actor_id, action, entity_type, entity_id, summary)
    values (${entry.actorId}, ${entry.action}, ${entry.entityType}, ${entry.entityId ?? null}, ${entry.summary.slice(0, 300)})`;
}
