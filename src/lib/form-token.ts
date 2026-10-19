import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { appSecret } from "@/lib/env";

// Token assinado com a hora de abertura do formulário (proteção anti-spam: envios
// instantâneos ou com tokens forjados/antigos são rejeitados).

const MIN_SECONDS = Number(process.env.FORM_MIN_SECONDS ?? 3);
const MAX_AGE_SECONDS = 24 * 60 * 60;

function sign(ts: string): string {
  return createHmac("sha256", appSecret()).update(`lead:${ts}`).digest("base64url").slice(0, 32);
}

export function createFormToken(): string {
  const ts = String(Date.now());
  return `${ts}.${sign(ts)}`;
}

export function verifyFormToken(token: string | null | undefined): "ok" | "fast" | "invalid" {
  if (!token || token.length > 80) return "invalid";
  const [ts, sig] = token.split(".");
  if (!ts || !sig || !/^\d{13}$/.test(ts)) return "invalid";
  const expected = Buffer.from(sign(ts));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";
  const age = (Date.now() - Number(ts)) / 1000;
  if (age < MIN_SECONDS) return "fast";
  if (age > MAX_AGE_SECONDS) return "invalid";
  return "ok";
}
