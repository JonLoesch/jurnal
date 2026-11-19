import type { Schedule } from "@/db/schema";
import { isHHMM, isoWeekday, weekStartOf, addDays, minutesOf } from "./time";

export const MEAL_TIMES = ["08:00", "12:30", "18:30"];
export const WEEKDAYS = [1, 2, 3, 4, 5];

export const SHORTCUTS: Record<string, Schedule> = {
  daily: { count: 1, period: "day" },
  weekdays: { count: 1, period: "day", weekdays: WEEKDAYS },
  "meal times": { count: MEAL_TIMES.length, period: "day", times: MEAL_TIMES },
};

export function validateSchedule(s: Schedule): string | null {
  if (!Number.isInteger(s.count) || s.count < 1 || s.count > 50) return "count must be 1-50";
  if (s.period !== "day" && s.period !== "week") return "period must be day or week";
  if (s.weekdays) {
    if (s.period !== "day") return "weekdays only apply to daily schedules";
    if (s.weekdays.length === 0 || s.weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7))
      return "weekdays must be 1-7";
  }
  if (s.times) {
    if (s.period !== "day") return "times only apply to daily schedules";
    if (s.times.some((t) => !isHHMM(t))) return "times must be HH:MM";
    if (s.times.length !== s.count) return "count must equal the number of times";
  }
  if (s.period === "week" && s.count > 7 * 20) return "too many per week";
  return null;
}

/** Is `date` a day on which a daily schedule expects entries? (Weekly schedules expect any day.) */
export function expectedOn(s: Schedule, date: string): boolean {
  if (s.period === "week") return true;
  return !s.weekdays || s.weekdays.includes(isoWeekday(date));
}

/**
 * Daily slots that have come due by `nowMinutes` (minutes after local midnight).
 * A schedule with explicit times has one slot per time; otherwise `count` slots all due at `deadline`.
 */
export function slotsDue(s: Schedule, deadline: string | undefined, nowMinutes: number): number {
  if (s.period !== "day") return 0;
  if (s.times) return s.times.filter((t) => minutesOf(t) <= nowMinutes).length;
  if (deadline && minutesOf(deadline) <= nowMinutes) return s.count;
  return 0;
}

/**
 * Weekly schedules: must the subject log today to still reach the target?
 * True when the entries still needed >= the days left in the week (including today).
 */
export function weeklyMustLogToday(
  s: Schedule,
  today: string,
  weekStart: number,
  entriesThisWeek: number,
): boolean {
  if (s.period !== "week") return false;
  const needed = s.count - entriesThisWeek;
  if (needed <= 0) return false;
  const start = weekStartOf(today, weekStart);
  const daysLeft = 7 - (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
  return needed >= daysLeft;
}

export function weekRange(today: string, weekStart: number): { start: string; end: string } {
  const start = weekStartOf(today, weekStart);
  return { start, end: addDays(start, 6) };
}
