import { describe, expect, it } from "vitest";
import { trendLine } from "@/lib/trend";

describe("trendLine", () => {
  it("fits a straight line", () => {
    const t = trendLine([
      { date: "2026-11-01", value: 10 },
      { date: "2026-11-02", value: 12 },
      { date: "2026-11-04", value: 16 },
    ])!;
    expect(t.slopePerDay).toBeCloseTo(2);
    expect(t.at("2026-11-03")).toBeCloseTo(14);
  });
  it("needs two different days", () => {
    expect(trendLine([{ date: "2026-11-01", value: 1 }])).toBeNull();
    expect(trendLine([{ date: "2026-11-01", value: 1 }, { date: "2026-11-01", value: 3 }])).toBeNull();
  });
});
