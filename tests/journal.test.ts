import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { addMetric, addSection, appendLogLine, createEntry, createJurnal, deleteEntry, removeLogLine, exportJurnal, getFeed, getMetricSeries, toCsv, updateEntry, updateMetric, updateSection } from "@/server/journal";
import { createInvite, redeemInvite } from "@/server/sharing";
import { makeAccount, testDb } from "./helpers";

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

async function setup() {
  const ann = await makeAccount(db, "Ann");
  const jurnal = await createJurnal(db, ann.id, "Fitness");
  const { loaded } = await getFeed(db, jurnal.id, { accountId: ann.id });
  const section = loaded.allSections[0];
  const weight = await addMetric(db, ann.id, section.id, { name: "Weight", fieldType: "number", config: { unit: "kg" } });
  const note = await addMetric(db, ann.id, section.id, { name: "Note", fieldType: "text" });
  return { ann, jurnal, section, weight, note };
}

describe("jurnals, sections and metrics", () => {
  it("creates a jurnal with a hidden default section", async () => {
    const { section } = await setup();
    expect(section.isDefault).toBe(true);
  });

  it("refuses protection and archiving on the default section", async () => {
    const { ann, section } = await setup();
    await expect(updateSection(db, ann.id, section.id, { protected: true })).rejects.toThrow(/protected metrics/);
    await expect(updateSection(db, ann.id, section.id, { archived: true })).rejects.toThrow(/default section/);
  });

  it("validates schedules and metric configs", async () => {
    const { ann, jurnal, section } = await setup();
    await expect(updateSection(db, ann.id, section.id, { schedule: { count: 0, period: "day" } })).rejects.toThrow();
    await updateSection(db, ann.id, section.id, { schedule: { count: 3, period: "week" } });
    await expect(addMetric(db, ann.id, section.id, { name: "Mood", fieldType: "choice", config: { choices: ["x"] } })).rejects.toThrow(/choices/);
    const extra = await addSection(db, ann.id, jurnal.id, "Evening");
    expect(extra.position).toBe(1);
  });

  it("does not let another account touch a jurnal", async () => {
    const { section } = await setup();
    const bob = await makeAccount(db, "Bob");
    await expect(addMetric(db, bob.id, section.id, { name: "x", fieldType: "text" })).rejects.toThrow(/Not found/);
  });
});

describe("entries", () => {
  it("saving again on a once-a-day section changes that day's entry instead of adding a second", async () => {
    const { ann, jurnal, section, weight, note } = await setup();
    const now = new Date("2026-11-05T15:00:00Z");
    const first = await createEntry(db, ann.id, section.id, { values: { [weight.id]: 80 } }, now);
    const again = await createEntry(db, ann.id, section.id, { values: { [note.id]: "felt good" } }, now);
    expect(again.id).toBe(first.id);
    const { feed } = await getFeed(db, jurnal.id, { accountId: ann.id });
    expect(feed).toHaveLength(1);
    expect(feed[0].values).toHaveLength(2);
    await createEntry(db, ann.id, section.id, { values: { [weight.id]: 81 } }, now);
    const after = (await getFeed(db, jurnal.id, { accountId: ann.id })).feed;
    expect(after[0].values.find((v) => v.metricId === weight.id)?.value).toBe(81);
  });

  it("turns a short-text metric into notes, keeping its values", async () => {
    const { ann, jurnal, section, note } = await setup();
    await createEntry(db, ann.id, section.id, { values: { [note.id]: "hello" } });
    await updateMetric(db, ann.id, note.id, { fieldType: "richtext" });
    const { feed } = await getFeed(db, jurnal.id, { accountId: ann.id });
    expect(feed[0].values[0].value).toEqual({ text: "hello", assetIds: [] });
    await expect(updateMetric(db, ann.id, note.id, { fieldType: "number" })).rejects.toThrow(/short text/);
  });

  it("defaults to today in the author's timezone", async () => {
    const { ann, section, weight } = await setup();
    // 02:30 UTC on Nov 5 is still Nov 4 in New York.
    const e = await createEntry(db, ann.id, section.id, { values: { [weight.id]: 80 } }, new Date("2026-11-05T02:30:00Z"));
    expect(e.effectiveDate).toBe("2026-11-04");
    expect(e.effectiveTime).toBe("21:30");
  });

  it("rejects future dates and accepts backfill, keeping added_at honest", async () => {
    const { ann, section, weight } = await setup();
    const now = new Date("2026-11-05T15:00:00Z");
    await expect(createEntry(db, ann.id, section.id, { effectiveDate: "2026-11-06", values: { [weight.id]: 1 } }, now)).rejects.toThrow(/future/);
    const e = await createEntry(db, ann.id, section.id, { effectiveDate: "2026-11-03", values: { [weight.id]: 80 } }, now);
    expect(e.effectiveDate).toBe("2026-11-03");
    expect(e.effectiveTime).toBeNull();
    expect(e.addedAt.toISOString()).toBe(now.toISOString());
  });

  it("validates values against the metric's field type", async () => {
    const { ann, section, weight } = await setup();
    await expect(createEntry(db, ann.id, section.id, { values: { [weight.id]: "heavy" } })).rejects.toThrow(/Weight/);
    await expect(createEntry(db, ann.id, section.id, { values: {} })).rejects.toThrow(/at least one/);
    await expect(createEntry(db, ann.id, section.id, { values: { "00000000-0000-0000-0000-000000000000": 1 } })).rejects.toThrow(/isn't in this section/);
  });

  it("edits the effective date and values, bumping updated_at only", async () => {
    const { ann, section, weight, note } = await setup();
    const t0 = new Date("2026-11-05T15:00:00Z");
    const e = await createEntry(db, ann.id, section.id, { values: { [weight.id]: 80, [note.id]: "ok" } }, t0);
    const t1 = new Date("2026-11-05T18:00:00Z");
    await updateEntry(db, ann.id, e.id, { effectiveDate: "2026-11-04", values: { [weight.id]: 79 } }, t1);
    const { feed } = await getFeed(db, (await db.query.sections.findFirst())!.jurnalId, { accountId: ann.id });
    expect(feed[0].effectiveDate).toBe("2026-11-04");
    expect(feed[0].values).toEqual([{ metricId: weight.id, value: 79 }]);
    expect(feed[0].addedAt?.toISOString()).toBe(t0.toISOString());
    expect(feed[0].updatedAt?.toISOString()).toBe(t1.toISOString());
  });

  it("keeps old values chartable after a metric is archived", async () => {
    const { ann, jurnal, section, weight } = await setup();
    await createEntry(db, ann.id, section.id, { effectiveDate: "2026-11-01", values: { [weight.id]: 81 } }, new Date("2026-11-05T15:00:00Z"));
    await createEntry(db, ann.id, section.id, { effectiveDate: "2026-11-02", values: { [weight.id]: 80.5 } }, new Date("2026-11-05T15:00:00Z"));
    await updateMetric(db, ann.id, weight.id, { archived: true });
    await expect(createEntry(db, ann.id, section.id, { values: { [weight.id]: 80 } })).rejects.toThrow(/archived/);
    const { points } = await getMetricSeries(db, jurnal.id, weight.id, { accountId: ann.id });
    expect(points).toEqual([
      { date: "2026-11-01", value: 81 },
      { date: "2026-11-02", value: 80.5 },
    ]);
  });

  it("deletes entries", async () => {
    const { ann, jurnal, section, weight } = await setup();
    const e = await createEntry(db, ann.id, section.id, { values: { [weight.id]: 80 } });
    await deleteEntry(db, ann.id, e.id);
    expect((await getFeed(db, jurnal.id, { accountId: ann.id })).feed).toHaveLength(0);
  });

  it("exports rows as CSV with quoting", async () => {
    const { ann, jurnal, section, note } = await setup();
    await createEntry(db, ann.id, section.id, { effectiveDate: "2026-11-01", values: { [note.id]: 'said "hi", then left' } }, new Date("2026-11-05T15:00:00Z"));
    const csv = toCsv((await exportJurnal(db, jurnal.id, { accountId: ann.id })).rows);
    expect(csv).toContain('"said ""hi"", then left"');
    expect(csv.split("\n")[0]).toBe("date,time,section,metric,value");
  });

  it("strips times from what a day-precision follower sees", async () => {
    const { ann, jurnal, section, weight } = await setup();
    const bob = await makeAccount(db, "Bob");
    await createEntry(db, ann.id, section.id, { values: { [weight.id]: 80 } }, new Date("2026-11-05T15:30:00Z"));
    await redeemInvite(db, bob.id, await createInvite(db, ann.id, jurnal.id));
    const { feed } = await getFeed(db, jurnal.id, { accountId: bob.id });
    expect(feed[0].effectiveDate).toBe("2026-11-05");
    expect(feed[0].effectiveTime).toBeUndefined();
    expect(feed[0].addedAt).toBeUndefined();
    expect(JSON.stringify(feed)).not.toContain("10:30");
  });
});

describe("running logs", () => {
  async function logSetup() {
    const { ann, jurnal, section } = await setup();
    const diet = await addMetric(db, ann.id, section.id, { name: "Diet", fieldType: "log" });
    return { ann, jurnal, section, diet };
  }
  const feedOf = async (jurnalId: string, accountId: string) => (await getFeed(db, jurnalId, { accountId })).feed;

  it("appends timestamped lines to one entry per day, and creates the entry on the first line", async () => {
    const { ann, jurnal, section, diet } = await logSetup();
    await appendLogLine(db, ann.id, diet.id, { text: "oatmeal and raspberries" }, new Date("2026-11-20T14:10:00Z"));
    await appendLogLine(db, ann.id, diet.id, { text: "  cheddar, two ounces ish " }, new Date("2026-11-20T15:21:00Z"));
    const feed = await feedOf(jurnal.id, ann.id);
    expect(feed).toHaveLength(1);
    expect(feed[0].sectionId).toBe(section.id);
    const lines = (feed[0].values[0].value as { lines: { at: string; text: string }[] }).lines;
    expect(lines.map((l) => [l.at, l.text])).toEqual([
      ["2026-11-20T14:10:00.000Z", "oatmeal and raspberries"],
      ["2026-11-20T15:21:00.000Z", "cheddar, two ounces ish"],
    ]);
  });

  it("starts a new entry on another day, and can backfill a day", async () => {
    const { ann, jurnal, diet } = await logSetup();
    await appendLogLine(db, ann.id, diet.id, { text: "today" }, new Date("2026-11-20T14:00:00Z"));
    await appendLogLine(db, ann.id, diet.id, { text: "yesterday, forgot", effectiveDate: "2026-11-19" }, new Date("2026-11-20T14:05:00Z"));
    expect((await feedOf(jurnal.id, ann.id)).map((e) => e.effectiveDate)).toEqual(["2026-11-20", "2026-11-19"]);
    await expect(appendLogLine(db, ann.id, diet.id, { text: "x", effectiveDate: "2026-11-21" }, new Date("2026-11-20T14:05:00Z"))).rejects.toThrow(/future/);
  });

  it("needs text or a photo, an owner, and a log metric", async () => {
    const { ann, section, note, diet } = await logSetup().then(async (s) => ({ ...s, note: (await getFeed(db, s.jurnal.id, { accountId: s.ann.id })).loaded.allMetrics.find((m) => m.name === "Note")! }));
    await expect(appendLogLine(db, ann.id, diet.id, { text: "   " })).rejects.toThrow(/Write something/);
    await expect(appendLogLine(db, ann.id, note.id, { text: "x" })).rejects.toThrow(/running log/);
    const bob = await makeAccount(db, "Bob");
    await expect(appendLogLine(db, bob.id, diet.id, { text: "x" })).rejects.toThrow(/Not found/);
    expect(section.id).toBeTruthy();
  });

  it("keeps photos with the line and removes a line cleanly", async () => {
    const { ann, jurnal, diet } = await logSetup();
    const { entryId, line } = await appendLogLine(db, ann.id, diet.id, { text: "lunch", photos: [{ key: "k1", contentType: "image/png", bytes: 3 }] });
    expect(line.assetIds).toHaveLength(1);
    const second = await appendLogLine(db, ann.id, diet.id, { text: "snack" });
    await removeLogLine(db, ann.id, entryId, diet.id, line.id);
    const lines = ((await feedOf(jurnal.id, ann.id))[0].values[0].value as { lines: { id: string }[] }).lines;
    expect(lines.map((l) => l.id)).toEqual([second.line.id]);
    await removeLogLine(db, ann.id, entryId, diet.id, second.line.id);
    expect((await feedOf(jurnal.id, ann.id))[0].values).toEqual([]); // the last line takes the value with it
  });

  it("an edit to the entry's other fields leaves the log alone", async () => {
    const { ann, jurnal, section, weight, diet } = await logSetup().then(async (s) => ({ ...s, weight: (await getFeed(db, s.jurnal.id, { accountId: s.ann.id })).loaded.allMetrics.find((m) => m.name === "Weight")! }));
    const e = await createEntry(db, ann.id, section.id, { values: { [weight.id]: 80 } }, new Date("2026-11-20T14:00:00Z"));
    await appendLogLine(db, ann.id, diet.id, { text: "breakfast" }, new Date("2026-11-20T14:30:00Z"));
    await updateEntry(db, ann.id, e.id, { values: { [weight.id]: 81 } }, new Date("2026-11-20T15:00:00Z"));
    const values = (await feedOf(jurnal.id, ann.id))[0].values;
    expect(values.map((v) => v.metricId).sort()).toEqual([diet.id, weight.id].sort());
    expect(values.find((v) => v.metricId === weight.id)?.value).toBe(81);
  });

  it("hides the time of each line from day-precision followers", async () => {
    const { ann, jurnal, diet } = await logSetup();
    const bob = await makeAccount(db, "Bob");
    await redeemInvite(db, bob.id, await createInvite(db, ann.id, jurnal.id));
    await appendLogLine(db, ann.id, diet.id, { text: "oatmeal" }, new Date("2026-11-20T14:10:00Z"));
    const seen = (await feedOf(jurnal.id, bob.id))[0].values[0].value as { lines: { at?: string; text: string }[] };
    expect(seen.lines.map((l) => l.text)).toEqual(["oatmeal"]);
    expect(JSON.stringify(seen)).not.toContain("14:10");
    expect(seen.lines[0].at).toBeUndefined();
  });
});
