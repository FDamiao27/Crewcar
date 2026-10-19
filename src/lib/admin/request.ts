import "server-only";
import { siteUrl } from "@/lib/env";

/** Proteção CSRF para route handlers: o pedido tem de vir da mesma origem. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    const o = new URL(origin);
    return o.host === host || o.origin === new URL(siteUrl()).origin;
  } catch {
    return false;
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
