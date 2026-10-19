import "server-only";

export const isProduction = process.env.NODE_ENV === "production";

export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function appSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) {
    if (isProduction) throw new Error("APP_SECRET tem de estar definido com pelo menos 32 caracteres.");
    return "desenvolvimento-apenas-nao-usar-em-producao-0000";
  }
  return secret;
}

/** Cookies "Secure" sempre que o site é servido por HTTPS. */
export function useSecureCookies(): boolean {
  return siteUrl().startsWith("https://");
}
