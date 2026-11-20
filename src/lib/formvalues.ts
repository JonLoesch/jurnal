import type { FieldType } from "@/db/schema";

type MetricLike = { id: string; fieldType: FieldType };

/**
 * Turn submitted form fields into entry values. Fields are named `m_<metricId>`; sets use
 * `m_<metricId>_reps_<i>` and `m_<metricId>_weight_<i>`. Blank fields are left out (not answered).
 * Numbers that don't parse are passed through as text so validation can report them.
 */
export function parseValues(metrics: MetricLike[], get: (name: string) => string | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const m of metrics) {
    const key = `m_${m.id}`;
    if (m.fieldType === "sets") {
      const sets: { reps: number; weight: number }[] = [];
      for (let i = 0; i < 50; i++) {
        const reps = get(`${key}_reps_${i}`);
        const weight = get(`${key}_weight_${i}`);
        if (reps === null && weight === null) break;
        if (!reps?.trim() && !weight?.trim()) continue;
        sets.push({ reps: Number(reps || 0), weight: Number(weight || 0) });
      }
      if (sets.length) out[m.id] = sets;
      continue;
    }
    const raw = get(key);
    if (raw === null || raw.trim() === "") continue;
    switch (m.fieldType) {
      case "number":
      case "duration":
      case "stars":
        out[m.id] = Number(raw);
        break;
      case "yesno":
        out[m.id] = raw === "yes" ? true : raw === "no" ? false : raw;
        break;
      case "richtext":
        out[m.id] = { text: raw, assetIds: [] };
        break;
      default:
        out[m.id] = raw;
    }
  }
  return out;
}

import type { Schedule } from "@/db/schema";
import { SHORTCUTS } from "./frequency";

/** Read a schedule from a preset ("daily", "weekdays", "meal times", "weekly:3", "times") plus optional custom times. */
export function parseSchedule(preset: string | null, customTimes: string | null): Schedule | null | "invalid" {
  const times = (customTimes ?? "").split(/[,\s]+/).filter(Boolean);
  // Times typed next to "Daily" (or no preset) mean "daily at these times"; never drop them silently.
  if (times.length && (!preset || preset === "daily" || preset === "times")) return { count: times.length, period: "day", times };
  if (!preset) return null;
  if (times.length && preset !== "times") return "invalid";
  if (preset in SHORTCUTS) return SHORTCUTS[preset];
  const weekly = /^weekly:(\d+)$/.exec(preset);
  if (weekly) return { count: Number(weekly[1]), period: "week" };
  return "invalid"; // "times" with no times typed lands here too
}

export function describeSchedule(s: Schedule | null): string {
  if (!s) return "No schedule";
  if (s.times) return `Daily at ${s.times.join(", ")}`;
  if (s.period === "week") return `${s.count} times a week`;
  if (s.weekdays?.join() === "1,2,3,4,5") return "Weekdays";
  return s.count === 1 ? "Daily" : `${s.count} times a day`;
}
