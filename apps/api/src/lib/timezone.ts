/**
 * Limites de dia/mês no fuso America/Sao_Paulo.
 *
 * Em Docker a API costuma rodar em UTC. Sem isso, "hoje" após ~21h (BRT)
 * já vira o dia seguinte e KPIs como "Buscas hoje" / "Importados hoje"
 * deixam de bater com o que o usuário vê no Brasil.
 */

export const APP_TIMEZONE = "America/Sao_Paulo";

function partsInTimeZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Offset em ms de `timeZone` em relação a UTC no instante `date`. */
function offsetMsAt(date: Date, timeZone: string): number {
  const p = partsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** Instant UTC correspondente a wall-clock local (Y-M-D H:M:S) em `timeZone`. */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone = APP_TIMEZONE
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = offsetMsAt(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

export function zonedDayKey(date: Date, timeZone = APP_TIMEZONE): string {
  const p = partsInTimeZone(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Início (00:00) e fim exclusivo do "hoje" no fuso do app. */
export function zonedTodayRange(now = new Date(), timeZone = APP_TIMEZONE) {
  const p = partsInTimeZone(now, timeZone);
  const start = zonedTimeToUtc(p.year, p.month, p.day, 0, 0, 0, timeZone);
  // Avança ~36h a partir do início e lê o dia civil seguinte (respeita DST).
  const nextParts = partsInTimeZone(new Date(start.getTime() + 36 * 60 * 60 * 1000), timeZone);
  const end = zonedTimeToUtc(nextParts.year, nextParts.month, nextParts.day, 0, 0, 0, timeZone);
  return { start, end, year: p.year, month: p.month, day: p.day };
}

/** Início e fim exclusivo do mês civil (1..12) no fuso do app. */
export function zonedMonthRange(year: number, month: number, timeZone = APP_TIMEZONE) {
  const start = zonedTimeToUtc(year, month, 1, 0, 0, 0, timeZone);
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = zonedTimeToUtc(endYear, endMonth, 1, 0, 0, 0, timeZone);
  return { start, end };
}

/** Faixa do último dia civil do mês (para KPIs de mês passado). */
export function zonedLastDayOfMonth(year: number, month: number, timeZone = APP_TIMEZONE) {
  const { end } = zonedMonthRange(year, month, timeZone);
  const lastInstant = new Date(end.getTime() - 1);
  const p = partsInTimeZone(lastInstant, timeZone);
  const dayStart = zonedTimeToUtc(p.year, p.month, p.day, 0, 0, 0, timeZone);
  return { dayStart, dayEnd: end, year: p.year, month: p.month, day: p.day };
}
