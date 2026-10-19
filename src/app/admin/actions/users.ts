"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { ActionError, runAction, type ActionResult } from "@/lib/admin/action";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { ROLES, type Role } from "@/lib/auth/permissions";
import { sql } from "@/lib/db";

function temporaryPassword(): string {
  return `${randomBytes(9).toString("base64url")}7k`;
}

const userSchema = z.object({
  name: z.string().trim().min(1, "Indique o nome.").max(120),
  email: z.string().trim().toLowerCase().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "E-mail inválido.").max(254),
  role: z.enum(["owner", "admin", "editor"]),
  password: z.string(),
});

async function ownersCount(excludeId?: string): Promise<number> {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from admin_users where role = 'owner' and is_active ${excludeId ? sql`and id <> ${excludeId}` : sql``}`;
  return r.n;
}

export async function createUser(input: { name: string; email: string; role: Role; password: string }): Promise<ActionResult<{ password?: string }>> {
  return runAction("users.manage", async (user) => {
    const parsed = userSchema.safeParse(input);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
      throw new ActionError("Verifique os campos assinalados.", fe);
    }
    const generated = !parsed.data.password;
    const password = parsed.data.password || temporaryPassword();
    const problem = passwordProblem(password);
    if (problem) throw new ActionError(problem, { password: problem });
    await sql`
      insert into admin_users (email, name, password_hash, role)
      values (${parsed.data.email}, ${parsed.data.name}, ${await hashPassword(password)}, ${parsed.data.role})`;
    await logActivity({ actorId: user.id, action: "criar", entityType: "utilizador", summary: `Criou o utilizador ${parsed.data.email} (${ROLES[parsed.data.role]})` });
    return { ok: true, message: "Utilizador criado.", data: generated ? { password } : {} };
  });
}

export async function updateUser(id: string, patch: { role?: Role; isActive?: boolean }): Promise<ActionResult> {
  return runAction("users.manage", async (user) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ActionError("Pedido inválido.");
    const [target] = await sql<{ role: Role; isActive: boolean; email: string }[]>`select role, is_active, email from admin_users where id = ${id}`;
    if (!target) throw new ActionError("O utilizador já não existe.");
    if (id === user.id && (patch.isActive === false || (patch.role && patch.role !== "owner")))
      throw new ActionError("Não pode desativar nem retirar o perfil de proprietário à sua própria conta.");
    const losingOwner = target.role === "owner" && ((patch.role && patch.role !== "owner") || patch.isActive === false);
    if (losingOwner && (await ownersCount(id)) === 0) throw new ActionError("Tem de existir pelo menos um proprietário ativo.");
    if (patch.role && !(patch.role in ROLES)) throw new ActionError("Perfil inválido.");
    await sql`
      update admin_users set
        role = ${patch.role ?? target.role},
        is_active = ${patch.isActive ?? target.isActive}
      where id = ${id}`;
    if (patch.isActive === false) await sql`delete from admin_sessions where user_id = ${id}`;
    await logActivity({ actorId: user.id, action: "editar", entityType: "utilizador", entityId: id, summary: `Atualizou o utilizador ${target.email}` });
    return { ok: true, message: patch.isActive === false ? "Utilizador desativado e sessões terminadas." : "Utilizador atualizado." };
  });
}

export async function resetUserPassword(id: string): Promise<ActionResult<{ password: string }>> {
  return runAction("users.manage", async (user) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ActionError("Pedido inválido.");
    const password = temporaryPassword();
    const [t] = await sql<{ email: string }[]>`
      update admin_users set password_hash = ${await hashPassword(password)}, password_changed_at = now(), failed_login_count = 0, locked_until = null
      where id = ${id} returning email`;
    if (!t) throw new ActionError("O utilizador já não existe.");
    await sql`delete from admin_sessions where user_id = ${id}`;
    await logActivity({ actorId: user.id, action: "password", entityType: "utilizador", entityId: id, summary: `Redefiniu a palavra-passe de ${t.email}` });
    return { ok: true, message: "Palavra-passe redefinida.", data: { password } };
  });
}
