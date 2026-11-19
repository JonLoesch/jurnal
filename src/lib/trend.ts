import { daysBetween } from "./time";

export type Point = { date: string; value: number };

/** Least-squares line through the points, x measured in days. Null if fewer than two distinct days. */
export function trendLine(points: Point[]): { slopePerDay: number; at: (date: string) => number } | null {
  if (points.length < 2) return null;
  const x0 = points[0].date;
  const xs = points.map((p) => daysBetween(x0, p.date));
  const ys = points.map((p) => p.value);
  const n = points.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const sxy = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
  const slope = sxy / sxx;
  return { slopePerDay: slope, at: (date) => my + slope * (daysBetween(x0, date) - mx) };
}
