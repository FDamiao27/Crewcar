import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { can, type Permission, type Role } from "@/lib/auth/permissions";
import { STORAGE_BUCKET, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config";

// Núcleo do back office no navegador: cliente Supabase com sessão, utilizador atual,
// execução de ações com verificação de permissões e tradução de erros da base de dados.
// A segurança efetiva é garantida pela base de dados (db/migrations/0005_admin_api.sql).

export const adminDb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "cc-admin-auth" },
});

export const bucket = () => adminDb.storage.from(STORAGE_BUCKET);

export type AdminUser = { id: string; email: string; name: string; role: Role };

let current: AdminUser | null = null;
export function setCurrentAdmin(user: AdminUser | null) {
  current = user;
}
export function currentAdmin(): AdminUser | null {
  return current;
}

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

const CONSTRAINTS: Record<string, [string, string?]> = {
  vehicles_reference_key: ["Já existe uma viatura com esta referência de stock.", "reference"],
  vehicles_slug_key: ["Este endereço já está a ser utilizado por outra viatura.", "slug"],
  vehicles_vin_key: ["Já existe uma viatura com este VIN.", "vin"],
  admin_users_email_key: ["Já existe um utilizador com este e-mail.", "email"],
  promotions_no_overlap: ["Já existe uma promoção ativa ou agendada que se sobrepõe a este período."],
  vehicles_published_requires_price: ["Indique o preço de venda antes de publicar.", "price"],
};

function translate(err: PostgrestError | { message?: string; code?: string; details?: string }): ActionResult<never> {
  const text = `${err.message ?? ""} ${"details" in err ? (err.details ?? "") : ""}`;
  for (const [name, [message, field]] of Object.entries(CONSTRAINTS)) {
    if (text.includes(name)) return { ok: false, message, fieldErrors: field ? { [field]: message } : undefined };
  }
  if (err.code === "42501" || /row-level security|permission denied/i.test(text))
    return { ok: false, message: "Não tem permissão para esta operação." };
  if (err.code === "23514") return { ok: false, message: "Os dados não cumprem as regras de validação. Verifique os valores introduzidos." };
  if (err.code === "23505") return { ok: false, message: "Já existe um registo com estes dados." };
  if (err.code === "P0001" && err.message) return { ok: false, message: err.message };
  if (/JWT|session/i.test(text)) return { ok: false, message: "Sessão expirada. Inicie sessão novamente." };
  console.error(err);
  return { ok: false, message: "Ocorreu um erro inesperado. Tente novamente." };
}

/** Lança o erro de uma resposta do Supabase para ser tratado por runAction. */
export function check<T>(res: { data: T; error: PostgrestError | null }): T {
  if (res.error) throw res.error;
  return res.data;
}

/** Notifica as páginas abertas para voltarem a carregar os dados. */
export function notifyChange() {
  window.dispatchEvent(new Event("cc-refresh"));
}

export async function runAction<T = undefined>(
  permission: Permission | null,
  fn: (user: AdminUser) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const user = current;
  if (!user) return { ok: false, message: "Sessão expirada. Inicie sessão novamente." };
  if (permission && !can(user.role, permission)) return { ok: false, message: "Não tem permissão para esta operação." };
  try {
    const result = await fn(user);
    if (result.ok) notifyChange();
    return result;
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, message: err.message, fieldErrors: err.fieldErrors };
    if (err && typeof err === "object" && ("code" in err || "message" in err)) return translate(err as PostgrestError);
    console.error(err);
    return { ok: false, message: "Ocorreu um erro inesperado. Tente novamente." };
  }
}

export async function logActivity(entry: {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
}): Promise<void> {
  const { error } = await adminDb.from("activity_log").insert({
    actor_id: current?.id ?? null,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    summary: entry.summary.slice(0, 300),
  });
  if (error) console.warn("Registo de atividade falhou", error);
}

type Row = Record<string, unknown>;

export function toCamel<T = Row>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  return out as T;
}

export function toSnake(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = v;
  return out;
}

/** Lê todas as linhas de uma consulta (a API devolve no máximo 1000 de cada vez). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any;

export async function fetchAll<T = Row>(table: string, columns = "*", build?: (q: Query) => unknown): Promise<T[]> {
  const rows: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    let q: Query = adminDb.from(table).select(columns).range(from, from + size - 1);
    if (build) q = build(q);
    const { data, error } = (await q) as { data: Row[] | null; error: PostgrestError | null };
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Row[]).map((r) => toCamel<T>(r)));
    if (!data || data.length < size) break;
  }
  return rows;
}
