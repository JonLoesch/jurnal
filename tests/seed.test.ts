import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { getFeed, listMyJurnals } from "@/server/journal";
import { seedMyJurnals } from "@/server/seed";
import { makeAccount, testDb } from "./helpers";

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

async function structure(accountId: string) {
  const out: Record<string, Record<string, string[]>> = {};
  for (const jurnal of await listMyJurnals(db, accountId)) {
    const { loaded } = await getFeed(db, jurnal.id, { accountId });
    out[jurnal.name] = {};
    for (const s of loaded.allSections.filter((s) => !s.isDefault)) {
      out[jurnal.name][s.name] = loaded.allMetrics.filter((m) => m.sectionId === s.id).map((m) => `${m.name}:${m.fieldType}`);
    }
  }
  return out;
}

describe("seedMyJurnals", () => {
  it("builds the Fitness and Habits structure", async () => {
    const ann = await makeAccount(db, "Ann");
    await seedMyJurnals(db, ann.id);
    const s = await structure(ann.id);
    expect(Object.keys(s)).toEqual(["Fitness", "Habits"]);
    expect(Object.keys(s.Fitness)).toEqual(["Lower Body Workout", "Upper Body Workout", "TBD Workout", "Activity"]);
    expect(s.Fitness["Lower Body Workout"].filter((m) => m.endsWith(":sets"))).toHaveLength(10);
    expect(s.Fitness["Lower Body Workout"]).toContain("Notes:richtext");
    expect(s.Fitness.Activity).toEqual(["Diet:log", "Other activity:log"]);
    expect(s.Habits.Morning.map((m) => m.split(":")[0])).toEqual(["Stretched", "Woke up at a reasonable time", "Made a plan for the day", "Got some early sun", "Notes"]);
    expect(s.Habits.Evening).toHaveLength(4);
  });

  it("sets weekly and daily schedules", async () => {
    const ann = await makeAccount(db, "Ann");
    await seedMyJurnals(db, ann.id);
    const fitness = (await listMyJurnals(db, ann.id)).find((x) => x.name === "Fitness")!;
    const { loaded } = await getFeed(db, fitness.id, { accountId: ann.id });
    const sched = Object.fromEntries(loaded.allSections.filter((s) => !s.isDefault).map((s) => [s.name, s.schedule]));
    expect(sched["Lower Body Workout"]).toEqual({ count: 1, period: "week" });
    expect(sched.Activity).toEqual({ count: 1, period: "day" });
  });

  it("is safe to run again, and only adds what's missing", async () => {
    const ann = await makeAccount(db, "Ann");
    expect((await seedMyJurnals(db, ann.id)).length).toBeGreaterThan(30);
    expect(await seedMyJurnals(db, ann.id)).toEqual([]);
    expect(Object.keys(await structure(ann.id))).toEqual(["Fitness", "Habits"]);
  });
});
