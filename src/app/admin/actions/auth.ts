"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { runAction, ActionError, type ActionResult } from "@/lib/admin/action";
import { hashPassword, passwordProblem, verifyPassword, verifyDummy } from "@/lib/auth/password";
import { clientIp, createSession, destroySession, revokeOtherSessions } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { hashIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";

export type LoginState = { error?: string; email?: string };

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "Indique o e-mail e a palavra-passe.", email };

  const ipKey = `login-ip:${hashIp(await clientIp())}`;
  const ipLimit = await rateLimit(ipKey, 20, 15 * 60);
  if (!ipLimit.ok) return { error: "Demasiadas tentativas. Aguarde alguns minutos e tente novamente.", email };

  const [user] = await sql<{ id: string; name: string; passwordHash: string; isActive: boolean; lockedUntil: Date | null; failedLoginCount: number }[]>`
    select id, name, password_hash, is_active, locked_until, failed_login_count from admin_users where email = ${email}`;

  if (!user) {
    await verifyDummy(password);
    return { error: "E-mail ou palavra-passe incorretos.", email };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "Conta temporariamente bloqueada após várias tentativas falhadas. Tente mais tarde.", email };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid || !user.isActive) {
    const failed = user.failedLoginCount + 1;
    await sql`
      update admin_users set failed_login_count = ${failed},
        locked_until = ${failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null}
      where id = ${user.id}`;
    return { error: "E-mail ou palavra-passe incorretos.", email };
  }

  await sql`update admin_users set failed_login_count = 0, locked_until = null, last_login_at = now() where id = ${user.id}`;
  await resetRateLimit(ipKey);
  await createSession(user.id);
  await logActivity({ actorId: user.id, action: "login", entityType: "sessao", summary: `${user.name} iniciou sessão` });
  const next = String(formData.get("next") ?? "");
  redirect(/^\/admin(\/[\w\-/]*)?$/.test(next) ? next : "/admin");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Indique a palavra-passe atual."),
    next: z.string(),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    const problem = passwordProblem(v.next);
    if (problem) ctx.addIssue({ code: "custom", path: ["next"], message: problem });
    if (v.next !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "As palavras-passe não coincidem." });
  });

export async function changePassword(input: { current: string; next: string; confirm: string }): Promise<ActionResult> {
  return runAction(null, async (user) => {
    const parsed = passwordSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
      throw new ActionError("Verifique os campos assinalados.", fieldErrors);
    }
    const [row] = await sql<{ passwordHash: string }[]>`select password_hash from admin_users where id = ${user.id}`;
    if (!(await verifyPassword(parsed.data.current, row.passwordHash))) {
      throw new ActionError("A palavra-passe atual está incorreta.", { current: "Palavra-passe incorreta." });
    }
    await sql`update admin_users set password_hash = ${await hashPassword(parsed.data.next)}, password_changed_at = now() where id = ${user.id}`;
    await revokeOtherSessions(user.id);
    await logActivity({ actorId: user.id, action: "password", entityType: "utilizador", entityId: user.id, summary: `${user.name} alterou a palavra-passe` });
    return { ok: true, message: "Palavra-passe alterada. As outras sessões foram terminadas." };
  });
}

export async function signOutOtherSessions(): Promise<ActionResult> {
  return runAction(null, async (user) => {
    await revokeOtherSessions(user.id);
    return { ok: true, message: "Sessões noutros dispositivos terminadas." };
  });
}
