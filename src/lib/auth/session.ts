import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sql } from "@/lib/db";
import { useSecureCookies } from "@/lib/env";
import { can, type Permission, type Role } from "./permissions";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // expira após 12 horas de inatividade
const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60; // duração máxima absoluta: 7 dias
const RENEW_AFTER_MS = 15 * 60 * 1000;

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export function sessionCookieName(): string {
  // O prefixo __Host- obriga a Secure, Path=/ e ausência de Domain (proteção contra subdomínios).
  return useSecureCookies() ? "__Host-cc_session" : "cc_session";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await sql`
    insert into admin_sessions (token_hash, user_id, expires_at, ip, user_agent)
    values (${hashToken(token)}, ${userId}, ${expires}, ${await clientIp()}, ${(h.get("user-agent") ?? "").slice(0, 300)})`;
  // Limpeza oportunista de sessões expiradas
  await sql`delete from admin_sessions where expires_at < now()`;
  const jar = await cookies();
  jar.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (token) await sql`delete from admin_sessions where token_hash = ${hashToken(token)}`;
  jar.delete(sessionCookieName());
}

/** Utilizador autenticado no pedido atual (ou null). Memorizado por pedido. */
export const getCurrentAdmin = cache(async (): Promise<AdminUser | null> => {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (!token || token.length > 100) return null;
  const tokenHash = hashToken(token);
  const rows = await sql<(AdminUser & { lastSeenAt: Date })[]>`
    select u.id, u.email, u.name, u.role, s.last_seen_at
    from admin_sessions s
    join admin_users u on u.id = s.user_id
    where s.token_hash = ${tokenHash}
      and s.expires_at > now()
      and s.created_at > now() - make_interval(secs => ${SESSION_MAX_AGE_S})
      and u.is_active`;
  const row = rows[0];
  if (!row) return null;
  if (Date.now() - new Date(row.lastSeenAt).getTime() > RENEW_AFTER_MS) {
    await sql`
      update admin_sessions
      set last_seen_at = now(), expires_at = ${new Date(Date.now() + SESSION_TTL_MS)}
      where token_hash = ${tokenHash}`;
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
});

/** Para páginas: redireciona para o login se não existir sessão válida ou permissão. */
export async function requireAdmin(permission?: Permission): Promise<AdminUser> {
  const user = await getCurrentAdmin();
  if (!user) redirect("/admin/login");
  if (permission && !can(user.role, permission)) redirect("/admin?erro=permissao");
  return user;
}

export class AuthError extends Error {}

/** Para server actions e route handlers: lança erro em vez de redirecionar. */
export async function assertAdmin(permission?: Permission): Promise<AdminUser> {
  const user = await getCurrentAdmin();
  if (!user) throw new AuthError("Sessão expirada. Inicie sessão novamente.");
  if (permission && !can(user.role, permission)) throw new AuthError("Não tem permissão para esta operação.");
  return user;
}

export async function revokeOtherSessions(userId: string): Promise<void> {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  await sql`delete from admin_sessions where user_id = ${userId} and token_hash <> ${token ? hashToken(token) : ""}`;
}
