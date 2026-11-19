import { describe, expect, it } from "vitest";
import { addDays, dateIn, daysBetween, isDate, isoWeekday, pastTimeToday, timeIn, weekStartOf } from "@/lib/time";

describe("time", () => {
  it("computes the local date in a timezone, not UTC", () => {
    const at = new Date("2026-11-05T02:30:00Z");
    expect(dateIn("UTC", at)).toBe("2026-11-05");
    expect(dateIn("America/New_York", at)).toBe("2026-11-04"); // 21:30 on Nov 4
    expect(dateIn("Pacific/Auckland", at)).toBe("2026-11-05");
  });

  it("computes the local time", () => {
    expect(timeIn("America/New_York", new Date("2026-11-05T02:30:00Z"))).toBe("21:30");
    expect(timeIn("UTC", new Date("2026-11-05T00:05:00Z"))).toBe("00:05");
  });

  it("handles the daylight saving boundary", () => {
    // US clocks fell back on 2026-11-01 at 06:00 UTC.
    expect(timeIn("America/New_York", new Date("2026-11-01T05:30:00Z"))).toBe("01:30");
    expect(timeIn("America/New_York", new Date("2026-11-01T06:30:00Z"))).toBe("01:30");
    expect(dateIn("America/New_York", new Date("2026-11-01T12:00:00Z"))).toBe("2026-11-01");
  });

  it("does date arithmetic without timezone drift", () => {
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-01", "2026-11-04")).toBe(3);
    expect(daysBetween("2026-11-04", "2026-11-01")).toBe(-3);
  });

  it("knows weekdays and week starts", () => {
    expect(isoWeekday("2026-11-19")).toBe(4); // Thursday
    expect(isoWeekday("2026-11-22")).toBe(7); // Sunday
    expect(weekStartOf("2026-11-19", 1)).toBe("2026-11-16");
    expect(weekStartOf("2026-11-22", 1)).toBe("2026-11-16");
    expect(weekStartOf("2026-11-22", 7)).toBe("2026-11-22");
    expect(weekStartOf("2026-11-19", 7)).toBe("2026-11-15");
  });

  it("validates dates", () => {
    expect(isDate("2026-11-04")).toBe(true);
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("11/04/2026")).toBe(false);
  });

  it("tells if a wall-clock time has passed in a timezone", () => {
    const at = new Date("2026-11-19T15:30:00Z"); // 10:30 in New York
    expect(pastTimeToday("America/New_York", at, "10:00")).toBe(true);
    expect(pastTimeToday("America/New_York", at, "10:31")).toBe(false);
    expect(pastTimeToday("UTC", at, "10:00")).toBe(true);
  });
});
