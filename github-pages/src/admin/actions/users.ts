// Versão no navegador de src/app/admin/actions/users.ts. As contas de acesso (Supabase Auth)
// são criadas pela função "admin-users", que é a única com a chave de serviço.
import { z } from "zod";
import { passwordProblem } from "@/lib/auth/password";
import { ROLES, type Role } from "@/lib/auth/permissions";
import { ActionError, adminDb, check, logActivity, runAction, type ActionResult } from "../core";

const userSchema = z.object({
  name: z.string().trim().min(1, "Indique o nome.").max(120),
  email: z.string().trim().toLowerCase().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "E-mail inválido.").max(254),
  role: z.enum(["owner", "admin", "editor"]),
  password: z.string(),
});

async function setAccessPassword(action: "create" | "reset", email: string, password?: string): Promise<string | undefined> {
  const { data, error } = await adminDb.functions.invoke<{ ok?: boolean; password?: string; error?: string; field?: string }>("admin-users", {
    body: { action, email, password },
  });
  if (error) {
    const message = "Não foi possível contactar o serviço de contas.";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json().catch(() => null);
      if (body?.error) throw new ActionError(body.error, body.field ? { [body.field]: body.error } : undefined);
    }
    throw new ActionError(message);
  }
  return data?.password;
}

async function ownersCount(excludeId?: string): Promise<number> {
  let q = adminDb.from("admin_users").select("id", { count: "exact", head: true }).eq("role", "owner").eq("is_active", true);
  if (excludeId) q = q.neq("id", excludeId);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function createUser(input: { name: string; email: string; role: Role; password: string }): Promise<ActionResult<{ password?: string }>> {
  return runAction("users.manage", async () => {
    const parsed = userSchema.safeParse(input);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
      throw new ActionError("Verifique os campos assinalados.", fe);
    }
    const problem = parsed.data.password ? passwordProblem(parsed.data.password) : null;
    if (problem) throw new ActionError(problem, { password: problem });
    const row = check(
      await adminDb.from("admin_users").insert({ email: parsed.data.email, name: parsed.data.name, role: parsed.data.role }).select("id").single(),
    ) as { id: string };
    let password: string | undefined;
    try {
      password = await setAccessPassword("create", parsed.data.email, parsed.data.password || undefined);
    } catch (err) {
      // Sem conta de acesso, o registo fica inativo para não deixar um utilizador incompleto
      await adminDb.from("admin_users").update({ is_active: false }).eq("id", row.id);
      throw err;
    }
    await logActivity({ action: "criar", entityType: "utilizador", summary: `Criou o utilizador ${parsed.data.email} (${ROLES[parsed.data.role]})` });
    return { ok: true, message: "Utilizador criado.", data: password ? { password } : {} };
  });
}

export async function updateUser(id: string, patch: { role?: Role; isActive?: boolean }): Promise<ActionResult> {
  return runAction("users.manage", async (user) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ActionError("Pedido inválido.");
    const target = check(await adminDb.from("admin_users").select("role,is_active,email").eq("id", id).maybeSingle()) as {
      role: Role;
      is_active: boolean;
      email: string;
    } | null;
    if (!target) throw new ActionError("O utilizador já não existe.");
    if (id === user.id && (patch.isActive === false || (patch.role && patch.role !== "owner")))
      throw new ActionError("Não pode desativar nem retirar o perfil de proprietário à sua própria conta.");
    const losingOwner = target.role === "owner" && ((patch.role && patch.role !== "owner") || patch.isActive === false);
    if (losingOwner && (await ownersCount(id)) === 0) throw new ActionError("Tem de existir pelo menos um proprietário ativo.");
    if (patch.role && !(patch.role in ROLES)) throw new ActionError("Perfil inválido.");
    check(await adminDb.from("admin_users").update({ role: patch.role ?? target.role, is_active: patch.isActive ?? target.is_active }).eq("id", id));
    await logActivity({ action: "editar", entityType: "utilizador", entityId: id, summary: `Atualizou o utilizador ${target.email}` });
    return { ok: true, message: patch.isActive === false ? "Utilizador desativado. Deixou de ter acesso ao back office." : "Utilizador atualizado." };
  });
}

export async function resetUserPassword(id: string): Promise<ActionResult<{ password: string }>> {
  return runAction("users.manage", async () => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ActionError("Pedido inválido.");
    const t = check(await adminDb.from("admin_users").select("email").eq("id", id).maybeSingle()) as { email: string } | null;
    if (!t) throw new ActionError("O utilizador já não existe.");
    const password = await setAccessPassword("reset", t.email);
    if (!password) throw new ActionError("Não foi possível gerar a palavra-passe.");
    await logActivity({ action: "password", entityType: "utilizador", entityId: id, summary: `Redefiniu a palavra-passe de ${t.email}` });
    return { ok: true, message: "Palavra-passe redefinida.", data: { password } };
  });
}
