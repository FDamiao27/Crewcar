import "server-only";
import { revalidatePath } from "next/cache";
import { assertAdmin, AuthError, type AdminUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { pgConstraint, pgErrorCode } from "@/lib/db";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export class ActionError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

const CONSTRAINT_MESSAGES: Record<string, [string, string?]> = {
  vehicles_reference_key: ["Já existe uma viatura com esta referência de stock.", "reference"],
  vehicles_slug_key: ["Este endereço já está a ser utilizado por outra viatura.", "slug"],
  vehicles_vin_key: ["Já existe uma viatura com este VIN.", "vin"],
  admin_users_email_key: ["Já existe um utilizador com este e-mail.", "email"],
  promotions_no_overlap: ["Já existe uma promoção ativa ou agendada que se sobrepõe a este período."],
  vehicles_published_requires_price: ["Indique o preço de venda antes de publicar.", "price"],
};

/**
 * Executa uma ação administrativa: verifica a sessão e a permissão no servidor,
 * converte erros conhecidos em mensagens claras e atualiza as páginas afetadas.
 */
export async function runAction<T = undefined>(
  permission: Permission | null,
  fn: (user: AdminUser) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const user = await assertAdmin(permission ?? undefined);
    const result = await fn(user);
    revalidatePath("/", "layout");
    return result;
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, message: err.message };
    if (err instanceof ActionError) return { ok: false, message: err.message, fieldErrors: err.fieldErrors };
    const code = pgErrorCode(err);
    const constraint = pgConstraint(err);
    if (constraint && CONSTRAINT_MESSAGES[constraint]) {
      const [message, field] = CONSTRAINT_MESSAGES[constraint];
      return { ok: false, message, fieldErrors: field ? { [field]: message } : undefined };
    }
    if (code === "23514") return { ok: false, message: "Os dados não cumprem as regras de validação. Verifique os valores introduzidos." };
    if (code === "23505") return { ok: false, message: "Já existe um registo com estes dados." };
    // Erros internos do Next.js (redirect/notFound) devem propagar
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) throw err;
    console.error("Erro na ação administrativa:", err);
    return { ok: false, message: "Ocorreu um erro inesperado. Tente novamente." };
  }
}
