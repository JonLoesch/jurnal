// Dates in Jurnal are calendar dates ("2026-11-04") in the author's timezone; instants are UTC.

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date ("YYYY-MM-DD") of an instant in a timezone. */
export function dateIn(tz: string, at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** The wall-clock time ("HH:MM") of an instant in a timezone. */
export function timeIn(tz: string, at: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
  return parts;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole calendar days from a to b (b - a); negative if b is earlier. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** ISO weekday of a calendar date: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** First day of the week containing `date`, where weeks start on `weekStart` (ISO 1-7). */
export function weekStartOf(date: string, weekStart: number): string {
  const back = (isoWeekday(date) - weekStart + 7) % 7;
  return addDays(date, -back);
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isHHMM(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function isDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && addDays(s, 0) === s;
}

/** True if `now`, seen in `tz`, is at or past `hhmm` on its own calendar date. */
export function pastTimeToday(tz: string, now: Date, hhmm: string): boolean {
  return minutesOf(timeIn(tz, now)) >= minutesOf(hhmm);
}
