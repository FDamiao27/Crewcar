import "server-only";
import { createHmac } from "node:crypto";
import { sql } from "@/lib/db";
import { appSecret } from "@/lib/env";

/**
 * Limitação de pedidos baseada na base de dados (funciona com várias instâncias do servidor).
 * Janela fixa: `limit` pedidos por `windowSeconds`.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const [row] = await sql<{ count: number }[]>`
    insert into rate_limits (key, window_start, count) values (${key}, ${windowStart}, 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`;
  if (Math.random() < 0.02) {
    await sql`delete from rate_limits where window_start < now() - interval '2 days'`;
  }
  const retryAfter = Math.ceil((windowStart.getTime() + windowMs - now) / 1000);
  return { ok: row.count <= limit, retryAfter };
}

export async function resetRateLimit(key: string): Promise<void> {
  await sql`delete from rate_limits where key = ${key}`;
}

/** Pseudonimiza o IP para chaves de limitação (não guardamos IPs em claro). */
export function hashIp(ip: string): string {
  return createHmac("sha256", appSecret()).update(ip).digest("hex").slice(0, 32);
}
