import { z } from "zod";
import type { FieldType } from "@/db/schema";
import { isHHMM, minutesOf } from "./time";

export const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: "text", label: "Short text" },
  { type: "richtext", label: "Notes (with photos)" },
  { type: "number", label: "Number" },
  { type: "stars", label: "1 to 5 stars" },
  { type: "yesno", label: "Yes / no" },
  { type: "choice", label: "Pick one" },
  { type: "timeofday", label: "Time of day" },
  { type: "duration", label: "Duration (minutes)" },
  { type: "sets", label: "Exercise sets (reps and weight)" },
  { type: "log", label: "Running log (timestamped lines you add to)" },
];

export type Checked = { ok: true; value: unknown; num: number | null } | { ok: false; error: string };

const fail = (error: string): Checked => ({ ok: false, error });

export type LogLine = { id: string; at: string; text: string; assetIds: string[] };

const logSchema = z.object({
  lines: z
    .array(
      z.object({
        id: z.string().uuid(),
        at: z.string().datetime(),
        text: z.string().max(5000),
        assetIds: z.array(z.string().uuid()).max(20).default([]),
      }),
    )
    .max(500),
});

const setSchema = z.array(z.object({ reps: z.number().int().min(0).max(1000), weight: z.number().min(0).max(10000) })).max(50);

export function validateConfig(type: FieldType, config: Record<string, unknown>): string | null {
  if (type === "choice") {
    const c = config.choices;
    if (!Array.isArray(c) || c.length < 2 || c.some((x) => typeof x !== "string" || !x.trim()))
      return "choices need at least two non-empty options";
  }
  if (type === "number" && config.unit !== undefined && typeof config.unit !== "string") return "unit must be text";
  if (type === "sets") {
    for (const k of ["targetSets", "targetReps"] as const)
      if (config[k] !== undefined && (!Number.isInteger(config[k]) || (config[k] as number) < 1)) return `${k} must be a positive whole number`;
  }
  return null;
}

/** Check a submitted value against a metric's field type; returns the stored value plus a numeric copy for trends. */
export function checkValue(type: FieldType, config: Record<string, unknown>, raw: unknown): Checked {
  switch (type) {
    case "text":
      if (typeof raw !== "string") return fail("expected text");
      if (raw.length > 5000) return fail("text is too long");
      return { ok: true, value: raw, num: null };
    case "richtext": {
      const parsed = z
        .object({ text: z.string().max(20000), assetIds: z.array(z.string().uuid()).max(20).optional() })
        .safeParse(raw);
      if (!parsed.success) return fail("expected notes");
      return { ok: true, value: { text: parsed.data.text, assetIds: parsed.data.assetIds ?? [] }, num: null };
    }
    case "number": {
      if (typeof raw !== "number" || !Number.isFinite(raw)) return fail("expected a number");
      if (typeof config.min === "number" && raw < config.min) return fail(`must be at least ${config.min}`);
      if (typeof config.max === "number" && raw > config.max) return fail(`must be at most ${config.max}`);
      return { ok: true, value: raw, num: raw };
    }
    case "stars":
      if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 5) return fail("expected 1 to 5 stars");
      return { ok: true, value: raw, num: raw };
    case "yesno":
      if (typeof raw !== "boolean") return fail("expected yes or no");
      return { ok: true, value: raw, num: raw ? 1 : 0 };
    case "choice": {
      const choices = (config.choices as string[]) ?? [];
      if (typeof raw !== "string" || !choices.includes(raw)) return fail("not one of the choices");
      return { ok: true, value: raw, num: null };
    }
    case "timeofday":
      if (typeof raw !== "string" || !isHHMM(raw)) return fail("expected a time like 07:30");
      return { ok: true, value: raw, num: minutesOf(raw) };
    case "duration":
      if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > 24 * 60) return fail("expected minutes");
      return { ok: true, value: raw, num: raw };
    case "log": {
      const parsed = logSchema.safeParse(raw);
      if (!parsed.success) return fail("expected a log of lines");
      return { ok: true, value: parsed.data, num: null };
    }
    case "sets": {
      const parsed = setSchema.safeParse(raw);
      if (!parsed.success) return fail("expected a list of sets with reps and weight");
      const top = parsed.data.reduce((m, s) => Math.max(m, s.weight), 0);
      return { ok: true, value: parsed.data, num: parsed.data.length ? top : null };
    }
  }
}
