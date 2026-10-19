// Formatação em português de Portugal (preços, números e datas).

export const DEFAULT_TIMEZONE = "Europe/Lisbon";

const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euroCents = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const integer = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0, useGrouping: "always" } as Intl.NumberFormatOptions);
const decimal1 = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 });

/** Preço em euros a partir de cêntimos. Mostra cêntimos apenas quando existem. */
export function formatPrice(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return cents % 100 === 0 ? euro.format(cents / 100) : euroCents.format(cents / 100);
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return integer.format(n);
}

export function formatKm(km: number | null | undefined): string {
  if (km === null || km === undefined) return "—";
  return `${integer.format(km)} km`;
}

export function formatPercent(value: number): string {
  return `${decimal1.format(value)}%`;
}

export function formatPower(hp: number | null | undefined): string | null {
  if (!hp) return null;
  return `${integer.format(hp)} cv`;
}

export function formatEngine(cc: number | null | undefined): string | null {
  if (!cc) return null;
  return `${integer.format(cc)} cm³`;
}

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  // Datas AAAA-MM-DD são datas civis: interpretar ao meio-dia UTC para evitar mudanças de dia.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00Z`);
  return new Date(value);
}

/** DD/MM/AAAA */
export function formatDate(value: Date | string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).format(
    toDate(value),
  );
}

/** DD/MM/AAAA, HH:MM */
export function formatDateTime(value: Date | string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(toDate(value));
}

export function formatRelative(value: Date | string, now = new Date()): string {
  const d = toDate(value);
  const diff = Math.round((d.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(diff, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(d);
}

/** Converte "12.500,50", "12500.5", "12 500 €" em cêntimos. Devolve null se inválido. */
export function parseEurosToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  let s = input.replace(/[€\s  ]/g, "").trim();
  if (!s) return null;
  if (/^-/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // O último separador é o decimal
    if (lastComma > lastDot) {
      const thousands = s.slice(0, lastComma).split(".");
      if (!thousands.slice(1).every((g) => g.length === 3)) return null;
      s = s.replace(/\./g, "").replace(",", ".");
    }
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 && s.indexOf(",") === lastComma ? s.replace(",", "") : s.replace(/,/g, ".");
    if ((s.match(/\./g) ?? []).length > 1) return null;
  } else if (lastDot > -1) {
    const parts = s.split(".");
    // "12.500" ou "1.250.000" → separador de milhares (grupos de 3 dígitos)
    if (parts.length > 2) {
      if (!parts.slice(1).every((g) => g.length === 3)) return null;
      s = parts.join("");
    } else if (parts.length === 2 && parts[1].length === 3) s = parts.join("");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const value = Math.round(Number(s) * 100);
  return Number.isSafeInteger(value) ? value : null;
}

/** Cêntimos → texto editável "12500" ou "12500,50". */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ",");
}

export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}
