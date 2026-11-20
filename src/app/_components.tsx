import type { ReactNode } from "react";
import { PhotoInput } from "./photo-input";
import { removeLogLineAction } from "./actions";
import type { Metric } from "@/lib/types";
import { trendLine, type Point } from "@/lib/trend";
import { daysBetween } from "@/lib/time";

export const input = "rounded border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900";
export const button =
  "rounded bg-neutral-900 px-3 py-1 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300";
export const linkButton = "text-sm underline underline-offset-2";
export const card = "rounded-lg border border-neutral-200 p-4 dark:border-neutral-800";

export function Flash({ error, children }: { error?: string; children?: ReactNode }) {
  if (!error && !children) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`mb-4 rounded border px-3 py-2 text-sm ${error ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100" : "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100"}`}
    >
      {error ?? children}
    </div>
  );
}

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** The input for one metric inside an entry form. */
export function MetricInput({ metric, value }: { metric: Metric; value?: unknown }) {
  const name = `m_${metric.id}`;
  const unit = (metric.config.unit as string | undefined) ?? "";
  switch (metric.fieldType) {
    case "text":
      return <input name={name} defaultValue={(value as string) ?? ""} className={`${input} w-full`} />;
    case "richtext": {
      const v = value as { text?: string } | undefined;
      return (
        <div className="space-y-1">
          <textarea name={name} defaultValue={v?.text ?? ""} rows={3} className={`${input} w-full`} />
          <PhotoInput name={`${name}_photos`} />
        </div>
      );
    }
    case "number":
    case "duration":
      return (
        <span>
          <input name={name} type="number" step="any" defaultValue={(value as number | undefined) ?? ""} className={`${input} w-28`} />{" "}
          <span className="text-sm text-neutral-500">{metric.fieldType === "duration" ? "minutes" : unit}</span>
        </span>
      );
    case "stars":
      return (
        <select name={name} defaultValue={value === undefined ? "" : String(value)} className={input}>
          <option value="">-</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)}
            </option>
          ))}
        </select>
      );
    case "yesno":
      return (
        <select name={name} defaultValue={value === undefined ? "" : value ? "yes" : "no"} className={input}>
          <option value="">-</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      );
    case "choice":
      return (
        <select name={name} defaultValue={(value as string) ?? ""} className={input}>
          <option value="">-</option>
          {((metric.config.choices as string[]) ?? []).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      );
    case "timeofday":
      return <input name={name} type="time" defaultValue={(value as string) ?? ""} className={input} />;
    case "sets": {
      const cur = (value as { reps: number; weight: number }[] | undefined) ?? [];
      const rows = Math.max(Number(metric.config.targetSets) || 3, cur.length);
      const targetReps = metric.config.targetReps as number | undefined;
      return (
        <div className="space-y-1">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-10 text-neutral-500">Set {i + 1}</span>
              <input name={`${name}_reps_${i}`} type="number" min="0" placeholder={targetReps ? String(targetReps) : "reps"} defaultValue={cur[i]?.reps ?? ""} className={`${input} w-16`} />
              <span>×</span>
              <input name={`${name}_weight_${i}`} type="number" min="0" step="any" placeholder="weight" defaultValue={cur[i]?.weight ?? ""} className={`${input} w-20`} />
              <span className="text-neutral-500">{unit || "lb"}</span>
            </div>
          ))}
        </div>
      );
    }
  }
}

export function ValueView({
  metric,
  value,
  tz,
  removable,
}: {
  metric: Metric;
  value: unknown;
  /** The jurnal's timezone, for showing when each log line was written. */
  tz?: string;
  /** Owners can remove log lines; pass where the entry lives. */
  removable?: { jurnalId: string; entryId: string };
}) {
  const unit = (metric.config.unit as string | undefined) ?? "";
  switch (metric.fieldType) {
    case "yesno":
      return <>{value ? "Yes" : "No"}</>;
    case "stars":
      return <span aria-label={`${value} of 5 stars`}>{"★".repeat(Number(value))}{"☆".repeat(5 - Number(value))}</span>;
    case "duration":
      return <>{String(value)} min</>;
    case "number":
      return <>{String(value)} {unit}</>;
    case "sets":
      return (
        <>
          {(value as { reps: number; weight: number }[]).map((s) => `${s.reps}×${s.weight}${unit || "lb"}`).join(", ")}
        </>
      );
    case "log": {
      const lines = (value as { lines: { id: string; at?: string; text: string; assetIds?: string[] }[] }).lines;
      return (
        <ul className="space-y-1">
          {lines.map((l) => (
            <li key={l.id}>
              {l.at && tz && (
                <span className="mr-2 text-xs text-neutral-500">
                  {new Date(l.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })}
                </span>
              )}
              <span className="whitespace-pre-wrap">{l.text}</span>
              <span className="ml-1 inline-flex flex-wrap gap-2 align-top">
                {(l.assetIds ?? []).map((id) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={id} src={`/api/assets/${id}`} alt="" className="max-h-40 rounded" />
                ))}
              </span>
              {removable && (
                <form action={removeLogLineAction} className="ml-2 inline">
                  <input type="hidden" name="jurnalId" value={removable.jurnalId} />
                  <input type="hidden" name="entryId" value={removable.entryId} />
                  <input type="hidden" name="metricId" value={metric.id} />
                  <input type="hidden" name="lineId" value={l.id} />
                  <button className="text-xs text-neutral-400 underline">remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      );
    }
    case "richtext": {
      const v = value as { text: string; assetIds?: string[] };
      return (
        <div>
          {v.text && <p className="whitespace-pre-wrap">{v.text}</p>}
          <div className="mt-1 flex flex-wrap gap-2">
            {(v.assetIds ?? []).map((id) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={id} src={`/api/assets/${id}`} alt="" className="max-h-48 rounded" />
            ))}
          </div>
        </div>
      );
    }
    default:
      return <span className="whitespace-pre-wrap">{String(value)}</span>;
  }
}

/** A small server-rendered line chart with an optional trend line. */
export function LineChart({ points, unit }: { points: Point[]; unit?: string }) {
  if (points.length === 0) return <p className="text-sm text-neutral-500">Nothing recorded yet.</p>;
  const W = 640, H = 220, L = 44, R = 12, T = 12, B = 28;
  const first = points[0].date;
  const span = Math.max(daysBetween(first, points[points.length - 1].date), 1);
  const ys = points.map((p) => p.value);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const x = (d: string) => L + ((daysBetween(first, d)) / span) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const trend = trendLine(points);
  const last = points[points.length - 1].date;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" role="img" aria-label="Trend chart">
        {[0, 0.5, 1].map((f) => {
          const v = lo + f * (hi - lo);
          return (
            <g key={f}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="currentColor" opacity="0.12" />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.6">{v.toFixed(v % 1 ? 1 : 0)}</text>
            </g>
          );
        })}
        <text x={L} y={H - 8} fontSize="11" fill="currentColor" opacity="0.6">{first}</text>
        <text x={W - R} y={H - 8} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.6">{last}</text>
        {trend && <line x1={x(first)} y1={y(trend.at(first))} x2={x(last)} y2={y(trend.at(last))} stroke="#d97706" strokeWidth="2" strokeDasharray="5 4" />}
        <path d={line} fill="none" stroke="#2563eb" strokeWidth="2" />
        {points.map((p, i) => <circle key={i} cx={x(p.date)} cy={y(p.value)} r="3" fill="#2563eb"><title>{`${p.date}: ${p.value}${unit ? ` ${unit}` : ""}`}</title></circle>)}
      </svg>
      {trend && (
        <figcaption className="text-sm text-neutral-600 dark:text-neutral-400">
          Dashed line: trend, {trend.slopePerDay >= 0 ? "+" : ""}{(trend.slopePerDay * 7).toFixed(2)}{unit ? ` ${unit}` : ""} per week.
        </figcaption>
      )}
    </figure>
  );
}
