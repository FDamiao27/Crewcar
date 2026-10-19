// Versão no navegador de src/app/admin/actions/auth.ts (Supabase Auth).
import { z } from "zod";
import { passwordProblem } from "@/lib/auth/password";
import { ActionError, adminDb, logActivity, runAction, setCurrentAdmin, type ActionResult } from "../core";
import { withBase } from "../../config";

export type LoginState = { error?: string; email?: string };

export async function logout(): Promise<void> {
  await adminDb.auth.signOut({ scope: "local" });
  setCurrentAdmin(null);
  window.location.assign(withBase("/admin/login"));
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
    const check = await adminDb.auth.signInWithPassword({ email: user.email, password: parsed.data.current });
    if (check.error) throw new ActionError("A palavra-passe atual está incorreta.", { current: "Palavra-passe incorreta." });
    const { error } = await adminDb.auth.updateUser({ password: parsed.data.next });
    if (error) throw new ActionError(/same/i.test(error.message) ? "A nova palavra-passe tem de ser diferente da atual." : "Não foi possível alterar a palavra-passe.");
    await adminDb.auth.signOut({ scope: "others" });
    await logActivity({ action: "password", entityType: "utilizador", entityId: user.id, summary: `${user.name} alterou a palavra-passe` });
    return { ok: true, message: "Palavra-passe alterada. As outras sessões foram terminadas." };
  });
}

export async function signOutOtherSessions(): Promise<ActionResult> {
  return runAction(null, async () => {
    const { error } = await adminDb.auth.signOut({ scope: "others" });
    if (error) throw new ActionError("Não foi possível terminar as outras sessões.");
    return { ok: true, message: "Sessões noutros dispositivos terminadas." };
  });
}
