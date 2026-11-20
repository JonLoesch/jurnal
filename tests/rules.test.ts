import { describe, expect, it } from "vitest";
import { evaluateRule, type RuleInput } from "@/lib/rules";
import { SHORTCUTS } from "@/lib/frequency";

const NY = "America/New_York";
// 2026-11-19 is a Thursday. 15:30Z = 10:30 in New York.
const at = (iso: string) => new Date(iso);

const self = (over: Partial<RuleInput> = {}): RuleInput => ({
  kind: "self",
  config: { type: "deadline", deadline: "10:00" },
  schedule: { count: 1, period: "day" },
  now: at("2026-11-19T15:30:00Z"),
  subjectTz: NY,
  subjectWeekStart: 1,
  recipientTz: NY,
  entryDates: [],
  addedDates: [],
  baselineDate: "2026-11-01",
  label: "Morning",
  ...over,
});
const absence = (days: number, over: Partial<RuleInput> = {}): RuleInput => ({
  ...self(),
  kind: "follower_absence",
  config: { type: "absence", days, notifyAt: "10:00" },
  ...over,
});

describe("self deadline rules", () => {
  it("is not due before the deadline", () => {
    expect(evaluateRule(self({ now: at("2026-11-19T14:59:00Z") })).due).toBe(false); // 09:59
  });

  it("is due after the deadline when nothing is logged today", () => {
    const r = evaluateRule(self());
    expect(r.due).toBe(true);
    if (r.due) expect(r.dedupeKey).toBe("day:2026-11-19:1");
  });

  it("is not due once today's entry exists", () => {
    expect(evaluateRule(self({ entryDates: ["2026-11-19"] })).due).toBe(false);
  });

  it("still fires if only yesterday was logged", () => {
    expect(evaluateRule(self({ entryDates: ["2026-11-18"] })).due).toBe(true);
  });

  it("uses the subject's timezone for the deadline", () => {
    // 07:30 UTC is 02:30 in New York: not due, even though 10:00 UTC deadline arithmetic would differ.
    expect(evaluateRule(self({ now: at("2026-11-19T07:30:00Z") })).due).toBe(false);
    // Same instant for a subject in Tokyo (16:30): past the deadline.
    expect(evaluateRule(self({ now: at("2026-11-19T07:30:00Z"), subjectTz: "Asia/Tokyo" })).due).toBe(true);
  });

  it("skips days a weekday schedule does not expect", () => {
    const wk = { schedule: SHORTCUTS.weekdays };
    expect(evaluateRule(self({ ...wk, now: at("2026-11-21T15:30:00Z") })).due).toBe(false); // Saturday
    expect(evaluateRule(self(wk)).due).toBe(true); // Thursday
  });

  it("fires once per missed slot for explicit times", () => {
    const meals = { schedule: SHORTCUTS["meal times"] }; // 08:00 12:30 18:30
    const noon = at("2026-11-19T17:00:00Z"); // 12:00 NY
    const first = evaluateRule(self({ ...meals, now: noon }));
    expect(first.due && first.dedupeKey).toBe("day:2026-11-19:1");
    // One meal logged, 13:00 NY: second slot (12:30) now missed.
    const second = evaluateRule(self({ ...meals, now: at("2026-11-19T18:00:00Z"), entryDates: ["2026-11-19"] }));
    expect(second.due && second.dedupeKey).toBe("day:2026-11-19:2");
    // Two meals logged by 13:00: nothing missed.
    expect(evaluateRule(self({ ...meals, now: at("2026-11-19T18:00:00Z"), entryDates: ["2026-11-19", "2026-11-19"] })).due).toBe(false);
  });

  it("only fires on a weekly target when today is the last chance", () => {
    const wk = { schedule: { count: 3, period: "week" as const } };
    expect(evaluateRule(self({ ...wk, now: at("2026-11-19T15:30:00Z") })).due).toBe(false); // Thu, 4 days left
    const fri = evaluateRule(self({ ...wk, now: at("2026-11-20T15:30:00Z") })); // Fri, 3 left, 0 done
    expect(fri.due).toBe(true);
    expect(evaluateRule(self({ ...wk, now: at("2026-11-20T15:30:00Z"), entryDates: ["2026-11-20"] })).due).toBe(false);
    expect(evaluateRule(self({ ...wk, now: at("2026-11-20T15:30:00Z"), entryDates: ["2026-11-16", "2026-11-17", "2026-11-18"] })).due).toBe(false);
  });
});

describe("follower absence rules", () => {
  it("counts only complete silent days", () => {
    // Last entry Nov 17. On Nov 19 at 10:30, the complete silent days are just Nov 18.
    expect(evaluateRule(absence(2, { entryDates: ["2026-11-17"] })).due).toBe(false);
    expect(evaluateRule(absence(1, { entryDates: ["2026-11-17"] })).due).toBe(true);
    // Last entry Nov 16: Nov 17 and 18 are complete silent days.
    expect(evaluateRule(absence(2, { entryDates: ["2026-11-16"] })).due).toBe(true);
  });

  it("waits for the delivery hour in the recipient's timezone", () => {
    const input = absence(1, { entryDates: ["2026-11-17"], now: at("2026-11-19T14:30:00Z") }); // 09:30 NY
    expect(evaluateRule(input).due).toBe(false);
    expect(evaluateRule({ ...input, now: at("2026-11-19T15:00:00Z") }).due).toBe(true); // 10:00 NY
  });

  it("is not due when something was logged today or yesterday", () => {
    expect(evaluateRule(absence(1, { entryDates: ["2026-11-19"] })).due).toBe(false);
    expect(evaluateRule(absence(1, { entryDates: ["2026-11-18"] })).due).toBe(false);
  });

  it("dedupes one alert per silence streak", () => {
    const a = evaluateRule(absence(1, { entryDates: ["2026-11-16"] }));
    const later = evaluateRule(absence(1, { entryDates: ["2026-11-16"], now: at("2026-11-20T15:30:00Z") }));
    expect(a.due && later.due && a.dedupeKey === later.dedupeKey).toBe(true);
    const newStreak = evaluateRule(absence(1, { entryDates: ["2026-11-16", "2026-11-17"], now: at("2026-11-20T15:30:00Z") }));
    expect(newStreak.due && newStreak.dedupeKey).toBe("absence:2026-11-17");
  });

  it("measures from the baseline when nothing was ever logged", () => {
    const r = evaluateRule(absence(3, { entryDates: [], baselineDate: "2026-11-15" }));
    expect(r.due).toBe(true);
    expect(evaluateRule(absence(5, { entryDates: [], baselineDate: "2026-11-15" })).due).toBe(false);
  });

  it("never reveals times: the message uses dates only", () => {
    const r = evaluateRule(absence(1, { entryDates: ["2026-11-16"] }));
    expect(r.due && r.message).not.toMatch(/\d:\d\d/);
  });

  it("ignores a self-kind rule evaluated as absence", () => {
    expect(evaluateRule({ ...absence(1), kind: "self" }).due).toBe(false);
  });
});

describe("follower digest rules", () => {
  const digest = (addedDates: string[], over: Partial<RuleInput> = {}): RuleInput => ({
    ...self(),
    kind: "follower_digest",
    config: { type: "digest", notifyAt: "10:00" },
    addedDates,
    ...over,
  });

  it("is due once yesterday's additions exist and the delivery hour has come", () => {
    const r = evaluateRule(digest(["2026-11-18", "2026-11-18", "2026-11-17"]));
    expect(r.due).toBe(true);
    if (r.due) {
      expect(r.dedupeKey).toBe("digest:2026-11-18");
      expect(r.message).toBe("Morning: 2 new entries yesterday");
    }
  });

  it("says entry, not entries, for one", () => {
    const r = evaluateRule(digest(["2026-11-18"]));
    if (r.due) expect(r.message).toBe("Morning: 1 new entry yesterday");
  });

  it("is not due with nothing added yesterday, or before the delivery hour", () => {
    expect(evaluateRule(digest([])).due).toBe(false);
    expect(evaluateRule(digest(["2026-11-19"])).due).toBe(false); // today's additions wait until tomorrow
    expect(evaluateRule(digest(["2026-11-18"], { now: at("2026-11-19T14:59:00Z") })).due).toBe(false); // 09:59
  });

  it("delivers at the recipient's hour, counting days in the subject's timezone", () => {
    // Recipient in Los Angeles: 10:05 there is 18:05Z.
    const input = digest(["2026-11-18"], { recipientTz: "America/Los_Angeles" });
    expect(evaluateRule({ ...input, now: at("2026-11-19T15:30:00Z") }).due).toBe(false); // 07:30 LA
    expect(evaluateRule({ ...input, now: at("2026-11-19T18:05:00Z") }).due).toBe(true);
  });

  it("only applies to follower_digest rules", () => {
    expect(evaluateRule(digest(["2026-11-18"], { kind: "self" })).due).toBe(false);
  });
});
