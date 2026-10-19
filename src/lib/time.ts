// Conversões entre a hora local de Portugal (campos datetime-local) e instantes UTC.

function partsIn(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-20T09:00" (hora local do fuso indicado) → Date. Devolve null se inválido. */
export function localInputToDate(value: string, timeZone = "Europe/Lisbon"): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
  if (Number.isNaN(guess)) return null;
  let result = guess - offsetMs(new Date(guess), timeZone);
  // Segunda passagem para lidar com mudanças de hora
  result = guess - offsetMs(new Date(result), timeZone);
  return new Date(result);
}

/** Date → "2026-10-20T09:00" na hora local do fuso indicado. */
export function dateToLocalInput(date: Date | string | null | undefined, timeZone = "Europe/Lisbon"): string {
  if (!date) return "";
  const p = partsIn(new Date(date), timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Data de hoje (AAAA-MM-DD) no fuso indicado. */
export function todayIn(timeZone = "Europe/Lisbon"): string {
  return dateToLocalInput(new Date(), timeZone).slice(0, 10);
}
