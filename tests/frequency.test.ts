import { describe, expect, it } from "vitest";
import { SHORTCUTS, expectedOn, slotsDue, validateSchedule, weeklyMustLogToday } from "@/lib/frequency";

describe("frequency", () => {
  it("validates schedules", () => {
    expect(validateSchedule({ count: 1, period: "day" })).toBeNull();
    expect(validateSchedule({ count: 0, period: "day" })).not.toBeNull();
    expect(validateSchedule({ count: 3, period: "week", weekdays: [1] })).not.toBeNull();
    expect(validateSchedule({ count: 2, period: "day", times: ["08:00"] })).not.toBeNull();
    expect(validateSchedule({ count: 1, period: "day", times: ["25:00"] })).not.toBeNull();
    for (const s of Object.values(SHORTCUTS)) expect(validateSchedule(s)).toBeNull();
  });

  it("knows which days a schedule expects entries", () => {
    expect(expectedOn(SHORTCUTS.weekdays, "2026-11-19")).toBe(true); // Thursday
    expect(expectedOn(SHORTCUTS.weekdays, "2026-11-21")).toBe(false); // Saturday
    expect(expectedOn(SHORTCUTS.daily, "2026-11-21")).toBe(true);
  });

  it("counts due slots for explicit times", () => {
    const meals = SHORTCUTS["meal times"]; // 08:00, 12:30, 18:30
    expect(slotsDue(meals, undefined, 7 * 60)).toBe(0);
    expect(slotsDue(meals, undefined, 8 * 60)).toBe(1);
    expect(slotsDue(meals, undefined, 13 * 60)).toBe(2);
    expect(slotsDue(meals, undefined, 23 * 60)).toBe(3);
  });

  it("makes all slots due at the deadline when there are no explicit times", () => {
    expect(slotsDue({ count: 1, period: "day" }, "10:00", 9 * 60 + 59)).toBe(0);
    expect(slotsDue({ count: 1, period: "day" }, "10:00", 10 * 60)).toBe(1);
    expect(slotsDue({ count: 2, period: "day" }, "21:00", 22 * 60)).toBe(2);
    expect(slotsDue({ count: 1, period: "day" }, undefined, 23 * 60)).toBe(0);
  });

  it("says when a weekly target can only be met by logging today", () => {
    const s = { count: 3, period: "week" as const };
    // Monday start. Mon Nov 16: 7 days left, need 3 -> no pressure.
    expect(weeklyMustLogToday(s, "2026-11-16", 1, 0)).toBe(false);
    // Thursday Nov 19: 4 days left (Thu-Sun), need 3 -> still ok.
    expect(weeklyMustLogToday(s, "2026-11-19", 1, 0)).toBe(false);
    // Friday Nov 20: 3 days left, need 3 -> must log today.
    expect(weeklyMustLogToday(s, "2026-11-20", 1, 0)).toBe(true);
    // Friday with one done: need 2, 3 days left -> fine.
    expect(weeklyMustLogToday(s, "2026-11-20", 1, 1)).toBe(false);
    // Target already met.
    expect(weeklyMustLogToday(s, "2026-11-22", 1, 3)).toBe(false);
    // Daily schedules never use this.
    expect(weeklyMustLogToday({ count: 1, period: "day" }, "2026-11-22", 1, 0)).toBe(false);
  });
});
