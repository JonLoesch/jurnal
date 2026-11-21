import type { RuleConfig, Schedule } from "@/db/schema";
import { SHORTCUTS, expectedOn, slotsDue, weekRange, weeklyMustLogToday } from "./frequency";
import { addDays, dateIn, daysBetween, minutesOf, pastTimeToday, timeIn } from "./time";

export type RuleInput = {
  kind: "self" | "follower_absence" | "follower_digest";
  config: RuleConfig;
  /** The watched section's schedule (self rules); null means one entry a day. */
  schedule: Schedule | null;
  now: Date;
  /** The person being journaled: their dates, deadlines and week start. */
  subjectTz: string;
  subjectWeekStart: number;
  /** The person notified, whose clock gates the delivery hour of follower alerts. */
  recipientTz: string;
  /** Effective dates of the entries the rule's owner is allowed to see, in the watched scope. */
  entryDates: string[];
  /** Digest rules: the dates, in the subject's timezone, on which entries the owner may see were added. */
  addedDates: string[];
  /** When watching began (the jurnal's creation date in the subject's timezone). */
  baselineDate: string;
  label: string;
};

export type RuleResult =
  | { due: false }
  | { due: true; dedupeKey: string; message: string; lastEffectiveDate: string | null };

const maxDate = (dates: string[]) => dates.reduce<string | null>((m, d) => (m === null || d > m ? d : m), null);

/**
 * Is this rule due right now? A pure function of the rule, the clock and the entries it may see.
 * Follower alerts only ever see day-level facts (effective dates) and count only complete days, so
 * they never reveal more than a day-precision grant allows.
 */
export function evaluateRule(i: RuleInput): RuleResult {
  const today = dateIn(i.subjectTz, i.now);

  if (i.config.type === "absence") {
    if (i.kind !== "follower_absence") return { due: false };
    const last = maxDate(i.entryDates) ?? i.baselineDate;
    const silentDays = daysBetween(last, today) - 1; // complete days with nothing, excluding today
    if (silentDays < i.config.days) return { due: false };
    if (!pastTimeToday(i.recipientTz, i.now, i.config.notifyAt)) return { due: false };
    return {
      due: true,
      dedupeKey: `absence:${last}`,
      message: `${i.label}: nothing logged for ${silentDays} days (last entry ${maxDate(i.entryDates) ? last : "none yet"})`,
      lastEffectiveDate: maxDate(i.entryDates),
    };
  }

  if (i.config.type === "digest") {
    if (i.kind !== "follower_digest") return { due: false };
    // Yesterday's additions, counted by the day they were added so backfilled entries are included. Only the day
    // is used, never the time, so this never says more than a day-precision grant allows.
    const yesterday = addDays(today, -1);
    const n = i.addedDates.filter((d) => d === yesterday).length;
    if (n === 0 || !pastTimeToday(i.recipientTz, i.now, i.config.notifyAt)) return { due: false };
    return {
      due: true,
      dedupeKey: `digest:${yesterday}`,
      message: `${i.label}: ${n} new ${n === 1 ? "entry" : "entries"} yesterday`,
      lastEffectiveDate: maxDate(i.entryDates),
    };
  }

  if (i.kind !== "self") return { due: false };
  const schedule = i.schedule ?? SHORTCUTS.daily;
  const deadline = i.config.deadline;
  const todayCount = i.entryDates.filter((d) => d === today).length;
  const last = maxDate(i.entryDates);

  if (schedule.period === "week") {
    if (!pastTimeToday(i.subjectTz, i.now, deadline) || todayCount > 0) return { due: false };
    const { start, end } = weekRange(today, i.subjectWeekStart);
    const thisWeek = i.entryDates.filter((d) => d >= start && d <= end).length;
    if (!weeklyMustLogToday(schedule, today, i.subjectWeekStart, thisWeek)) return { due: false };
    return {
      due: true,
      dedupeKey: `week:${today}`,
      message: `${i.label}: ${schedule.count - thisWeek} more this week, and today is the last chance to make ${schedule.count}`,
      lastEffectiveDate: last,
    };
  }

  // "previous": the day being checked is yesterday, and the deadline is a time today (a morning nudge about
  // what was missed, not a nag before the day has happened).
  if (i.config.forDay === "previous") {
    const day = addDays(today, -1);
    const n = i.entryDates.filter((d) => d === day).length;
    if (!expectedOn(schedule, day) || n >= schedule.count || !pastTimeToday(i.subjectTz, i.now, deadline)) return { due: false };
    return {
      due: true,
      dedupeKey: `day:${day}:${n + 1}`,
      message: `${i.label}: nothing logged yesterday`,
      lastEffectiveDate: last,
    };
  }

  if (!expectedOn(schedule, today)) return { due: false };
  const slots = slotsDue(schedule, deadline, minutesOf(timeIn(i.subjectTz, i.now)));
  if (slots === 0 || todayCount >= slots) return { due: false };
  return {
    due: true,
    dedupeKey: `day:${today}:${todayCount + 1}`,
    message: `${i.label}: not logged yet today (due ${schedule.times ? schedule.times[todayCount] : deadline})`,
    lastEffectiveDate: last,
  };
}
