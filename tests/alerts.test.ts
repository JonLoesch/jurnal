import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { addMetric, addSection, createEntry, createJurnal, getFeed, updateSection } from "@/server/journal";
import { createInvite, redeemInvite, listGrants, updateGrantOptions, revokeGrant, grantProtected } from "@/server/sharing";
import {
  alertLinkStatus,
  createAbsenceRule,
  createDigestRule,
  createSelfRule,
  deleteRule,
  dismissFiring,
  getOverdue,
  listAlertsOnMyJurnal,
  runTick,
  snoozeFiring,
} from "@/server/alerts";
import { RecordingNotifier } from "@/server/notify";
import { makeAccount, testDb } from "./helpers";
import { alertFirings } from "@/db/schema";

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

// Created Nov 10 (12:00 NY). Ann is in New York, Coach (Bob) in Los Angeles.
const created = new Date("2026-11-10T17:00:00Z");

async function setup() {
  const ann = await makeAccount(db, "Ann", "America/New_York");
  const bob = await makeAccount(db, "Bob", "America/Los_Angeles");
  const jurnal = await createJurnal(db, ann.id, "Fitness");
  // Back-date creation so the baseline is deterministic.
  await db.execute(sql`update jurnal set created_at = ${created.toISOString()}`);
  const { loaded } = await getFeed(db, jurnal.id, { accountId: ann.id });
  const section = loaded.allSections[0];
  const note = await addMetric(db, ann.id, section.id, { name: "Note", fieldType: "text" });
  return { ann, bob, jurnal, section, note };
}

const log = (ann: { id: string }, sectionId: string, noteId: string, date: string) =>
  createEntry(db, ann.id, sectionId, { effectiveDate: date, values: { [noteId]: "x" } }, new Date(`${date}T23:00:00Z`));

describe("self reminders", () => {
  it("fires once when the deadline passes, not again, and stops when logged", async () => {
    const { ann, jurnal, section, note } = await setup();
    await createSelfRule(db, ann.id, { jurnalId: jurnal.id, deadline: "10:00" });
    const n = new RecordingNotifier();

    expect((await runTick(db, n, new Date("2026-11-19T14:59:00Z"))).fired).toBe(0); // 09:59
    expect((await runTick(db, n, new Date("2026-11-19T15:01:00Z"))).fired).toBe(1); // 10:01
    expect((await runTick(db, n, new Date("2026-11-19T16:00:00Z"))).fired).toBe(0); // same day: deduped
    expect(n.sent).toHaveLength(1);
    expect(n.sent[0].accountId).toBe(ann.id);
    expect(n.sent[0].payload.url).toMatch(/from=alert&firing=/);

    expect((await runTick(db, n, new Date("2026-11-20T15:01:00Z"))).fired).toBe(1); // next day fires again
    await log(ann, section.id, note.id, "2026-11-21");
    expect((await runTick(db, n, new Date("2026-11-21T15:01:00Z"))).fired).toBe(0); // logged
  });

  it("shows an overdue banner until something is logged, then clears it", async () => {
    const { ann, jurnal, section, note } = await setup();
    await createSelfRule(db, ann.id, { jurnalId: jurnal.id, deadline: "10:00" });
    const t = new Date("2026-11-19T15:30:00Z");
    await runTick(db, new RecordingNotifier(), t);
    expect(await getOverdue(db, ann.id, t)).toHaveLength(1);
    await log(ann, section.id, note.id, "2026-11-19");
    expect(await getOverdue(db, ann.id, t)).toHaveLength(0);
  });

  it("supports snooze and dismiss", async () => {
    const { ann, jurnal } = await setup();
    await createSelfRule(db, ann.id, { jurnalId: jurnal.id, deadline: "10:00" });
    const n = new RecordingNotifier();
    const t = new Date("2026-11-19T15:30:00Z");
    await runTick(db, n, t);
    const [f] = await db.select().from(alertFirings);

    await snoozeFiring(db, ann.id, f.id, new Date("2026-11-19T17:00:00Z"));
    expect(await getOverdue(db, ann.id, t)).toHaveLength(0); // hidden while snoozed
    expect((await runTick(db, n, new Date("2026-11-19T16:00:00Z"))).resent).toBe(0);
    const later = await runTick(db, n, new Date("2026-11-19T17:05:00Z"));
    expect(later.resent).toBe(1);
    expect(n.sent[1].payload.body).toMatch(/^Reminder:/);
    expect((await runTick(db, n, new Date("2026-11-19T17:10:00Z"))).resent).toBe(0);

    await dismissFiring(db, ann.id, f.id);
    expect(await getOverdue(db, ann.id, new Date("2026-11-19T18:00:00Z"))).toHaveLength(0);
  });

  it("does not re-send a snoozed reminder that was resolved in the meantime", async () => {
    const { ann, jurnal, section, note } = await setup();
    await createSelfRule(db, ann.id, { jurnalId: jurnal.id, deadline: "10:00" });
    const n = new RecordingNotifier();
    await runTick(db, n, new Date("2026-11-19T15:30:00Z"));
    const [f] = await db.select().from(alertFirings);
    await snoozeFiring(db, ann.id, f.id, new Date("2026-11-19T17:00:00Z"));
    await log(ann, section.id, note.id, "2026-11-19");
    expect((await runTick(db, n, new Date("2026-11-19T17:05:00Z"))).resent).toBe(0);
  });

  it("only lets people set self reminders on their own jurnals, and delete their own rules", async () => {
    const { ann, bob, jurnal } = await setup();
    await expect(createSelfRule(db, bob.id, { jurnalId: jurnal.id, deadline: "10:00" })).rejects.toThrow(/Not found/);
    const r = await createSelfRule(db, ann.id, { jurnalId: jurnal.id, deadline: "10:00" });
    await expect(deleteRule(db, bob.id, r.id)).rejects.toThrow(/Not found/);
    await deleteRule(db, ann.id, r.id);
  });

  it("supports a section deadline: morning and evening on one jurnal", async () => {
    const { ann, jurnal } = await setup();
    const evening = await addSection(db, ann.id, jurnal.id, "Evening");
    const done = await addMetric(db, ann.id, evening.id, { name: "Teeth", fieldType: "yesno" });
    await updateSection(db, ann.id, evening.id, { schedule: { count: 1, period: "day" } });
    await createSelfRule(db, ann.id, { jurnalId: jurnal.id, sectionId: evening.id, deadline: "21:00" });
    const n = new RecordingNotifier();
    expect((await runTick(db, n, new Date("2026-11-19T15:30:00Z"))).fired).toBe(0); // 10:30
    expect((await runTick(db, n, new Date("2026-11-20T02:30:00Z"))).fired).toBe(1); // 21:30 on the 19th
    expect(n.sent[0].payload.body).toContain("Fitness / Evening");
    expect(done.id).toBeTruthy();
  });
});

describe("follower absence alerts", () => {
  async function follow(canAlert: boolean) {
    const s = await setup();
    await redeemInvite(db, s.bob.id, await createInvite(db, s.ann.id, s.jurnal.id, { canAlert }));
    return s;
  }

  it("needs the owner's permission", async () => {
    const { bob, jurnal } = await follow(false);
    await expect(createAbsenceRule(db, bob.id, { jurnalId: jurnal.id, days: 2 })).rejects.toThrow(/permission/);
    const carol = await makeAccount(db, "Carol");
    await expect(createAbsenceRule(db, carol.id, { jurnalId: jurnal.id, days: 2 })).rejects.toThrow(/permission|Not found/);
  });

  it("notifies only the follower, at their delivery hour in their timezone, once per streak", async () => {
    const { ann, bob, jurnal, section, note } = await follow(true);
    await log(ann, section.id, note.id, "2026-11-16");
    await createAbsenceRule(db, bob.id, { jurnalId: jurnal.id, days: 2 }); // 10:00 Los Angeles
    const n = new RecordingNotifier();

    // Nov 19, 10:00 NY = 07:00 LA: silent days Nov 17 and 18 qualify, but Bob's hour hasn't come.
    expect((await runTick(db, n, new Date("2026-11-19T15:00:00Z"))).fired).toBe(0);
    // 10:05 LA = 18:05Z.
    expect((await runTick(db, n, new Date("2026-11-19T18:05:00Z"))).fired).toBe(1);
    expect(n.sent.map((s) => s.accountId)).toEqual([bob.id]); // never the subject
    expect((await runTick(db, n, new Date("2026-11-20T18:05:00Z"))).fired).toBe(0); // same streak

    // A new entry, then a new silence, alerts again.
    await log(ann, section.id, note.id, "2026-11-20");
    expect((await runTick(db, n, new Date("2026-11-23T18:05:00Z"))).fired).toBe(1);
  });

  it("only counts what the follower can see: entries in a protected section don't hide the silence", async () => {
    const { ann, bob, jurnal, section, note } = await follow(true);
    const secret = await addSection(db, ann.id, jurnal.id, "Diary");
    await updateSection(db, ann.id, secret.id, { protected: true });
    const diary = await addMetric(db, ann.id, secret.id, { name: "D", fieldType: "text" });
    await log(ann, section.id, note.id, "2026-11-10");
    await createEntry(db, ann.id, secret.id, { effectiveDate: "2026-11-18", values: { [diary.id]: "private" } }, new Date("2026-11-19T12:00:00Z"));
    await createAbsenceRule(db, bob.id, { jurnalId: jurnal.id, days: 3 });
    const n = new RecordingNotifier();
    expect((await runTick(db, n, new Date("2026-11-19T18:05:00Z"))).fired).toBe(1);
    expect(JSON.stringify(n.sent)).not.toContain("private");
  });

  it("lets a section grant widen what an alert sees", async () => {
    const { ann, bob, jurnal, section, note } = await follow(true);
    const secret = await addSection(db, ann.id, jurnal.id, "Diary");
    await updateSection(db, ann.id, secret.id, { protected: true });
    const diary = await addMetric(db, ann.id, secret.id, { name: "D", fieldType: "text" });
    await log(ann, section.id, note.id, "2026-11-10");
    await createEntry(db, ann.id, secret.id, { effectiveDate: "2026-11-18", values: { [diary.id]: "private" } }, new Date("2026-11-19T12:00:00Z"));
    await grantProtected(db, ann.id, jurnal.id, { scope: "section", scopeId: secret.id, granteeId: bob.id });
    await createAbsenceRule(db, bob.id, { jurnalId: jurnal.id, days: 3 });
    expect((await runTick(db, new RecordingNotifier(), new Date("2026-11-19T18:05:00Z"))).fired).toBe(0);
  });

  it("goes dormant and is deleted when permission or access is withdrawn", async () => {
    const { ann, bob, jurnal } = await follow(true);
    await createAbsenceRule(db, bob.id, { jurnalId: jurnal.id, days: 1 });
    const [g] = await listGrants(db, ann.id, jurnal.id);
    await updateGrantOptions(db, ann.id, g.grant.id, { canAlert: false });
    expect(await listAlertsOnMyJurnal(db, ann.id, jurnal.id)).toHaveLength(0);
    await updateGrantOptions(db, ann.id, g.grant.id, { canAlert: true });
    await createAbsenceRule(db, bob.id, { jurnalId: jurnal.id, days: 1 });
    await revokeGrant(db, ann.id, g.grant.id);
    expect(await listAlertsOnMyJurnal(db, ann.id, jurnal.id)).toHaveLength(0);
    expect((await runTick(db, new RecordingNotifier(), new Date("2026-11-19T18:05:00Z"))).evaluated).toBe(0);
  });

  it("lets the subject see which alerts exist on their jurnal", async () => {
    const { ann, bob, jurnal } = await follow(true);
    await createAbsenceRule(db, bob.id, { jurnalId: jurnal.id, days: 3 });
    const seen = await listAlertsOnMyJurnal(db, ann.id, jurnal.id);
    expect(seen.map((s) => [s.followerName, (s.rule.config as { days: number }).days])).toEqual([["Bob", 3]]);
    await expect(listAlertsOnMyJurnal(db, bob.id, jurnal.id)).rejects.toThrow(/Not found/);
  });

  it("tells the alert link whether something was logged since the alert fired", async () => {
    const { ann, bob, jurnal, section, note } = await follow(true);
    await createAbsenceRule(db, bob.id, { jurnalId: jurnal.id, days: 2 });
    await runTick(db, new RecordingNotifier(), new Date("2026-11-19T18:05:00Z"));
    const [f] = await db.select().from(alertFirings);
    expect((await alertLinkStatus(db, bob.id, f.id)).newerEntryExists).toBe(false);
    await createEntry(db, ann.id, section.id, { values: { [note.id]: "back" } }, new Date("2026-11-19T20:00:00Z"));
    expect((await alertLinkStatus(db, bob.id, f.id)).newerEntryExists).toBe(true);
    await expect(alertLinkStatus(db, ann.id, f.id)).rejects.toThrow(/Not found/);
  });
});

describe("follower digests", () => {
  async function follow() {
    const s = await setup();
    await redeemInvite(db, s.bob.id, await createInvite(db, s.ann.id, s.jurnal.id)); // no alert permission needed
    return s;
  }
  // The rule is created "now"; back-date it so test timestamps from November count as after it.
  const backdate = () => db.execute(sql`update reminder_rule set created_at = ${created.toISOString()}`);
  const added = (ann: { id: string }, sectionId: string, noteId: string, date: string, addedAt: string) =>
    createEntry(db, ann.id, sectionId, { effectiveDate: date, values: { [noteId]: "x" } }, new Date(addedAt));

  it("lets any follower ask, but not the owner or a stranger, and not twice", async () => {
    const { ann, bob, jurnal } = await follow();
    await createDigestRule(db, bob.id, { jurnalId: jurnal.id });
    await expect(createDigestRule(db, bob.id, { jurnalId: jurnal.id })).rejects.toThrow(/already/);
    await expect(createDigestRule(db, ann.id, { jurnalId: jurnal.id })).rejects.toThrow(/shared with/);
    const carol = await makeAccount(db, "Carol");
    await expect(createDigestRule(db, carol.id, { jurnalId: jurnal.id })).rejects.toThrow(/Not found|shared with/);
  });

  it("fires once at the follower's hour for yesterday's additions, counting backfills", async () => {
    const { ann, bob, jurnal, section, note } = await follow();
    await createDigestRule(db, bob.id, { jurnalId: jurnal.id }); // 10:00 Los Angeles
    await backdate();
    // Two entries added on Nov 18 (NY): one for that day, one backfilled for Nov 12.
    await added(ann, section.id, note.id, "2026-11-18", "2026-11-18T15:00:00Z");
    await added(ann, section.id, note.id, "2026-11-12", "2026-11-18T16:00:00Z");
    const n = new RecordingNotifier();

    expect((await runTick(db, n, new Date("2026-11-19T15:00:00Z"))).fired).toBe(0); // 07:00 LA, too early
    expect((await runTick(db, n, new Date("2026-11-19T18:05:00Z"))).fired).toBe(1);
    expect(n.sent.map((s) => s.accountId)).toEqual([bob.id]);
    expect(n.sent[0].payload.body).toBe("Fitness: 2 new entries yesterday");
    expect(n.sent[0].payload.url).toBe(`/j/${jurnal.id}`); // plain link, no ?from=alert
    expect((await runTick(db, n, new Date("2026-11-19T19:05:00Z"))).fired).toBe(0); // once per day
    expect((await runTick(db, n, new Date("2026-11-20T18:05:00Z"))).fired).toBe(0); // nothing new Nov 19
  });

  it("stays quiet on days nothing was added, and ignores entries from before it was set up", async () => {
    const { ann, bob, jurnal, section, note } = await follow();
    await added(ann, section.id, note.id, "2026-11-17", "2026-11-17T15:00:00Z"); // before the rule exists
    await createDigestRule(db, bob.id, { jurnalId: jurnal.id });
    await db.execute(sql`update reminder_rule set created_at = ${"2026-11-18T12:00:00Z"}`);
    const n = new RecordingNotifier();
    expect((await runTick(db, n, new Date("2026-11-18T18:05:00Z"))).fired).toBe(0); // would count Nov 17
    expect((await runTick(db, n, new Date("2026-11-19T18:05:00Z"))).fired).toBe(0); // nothing added Nov 18
  });

  it("does not count entries in sections the follower cannot see", async () => {
    const { ann, bob, jurnal, section, note } = await follow();
    const secret = await addSection(db, ann.id, jurnal.id, "Diary");
    await updateSection(db, ann.id, secret.id, { protected: true });
    const diary = await addMetric(db, ann.id, secret.id, { name: "D", fieldType: "text" });
    await createDigestRule(db, bob.id, { jurnalId: jurnal.id });
    await backdate();
    await createEntry(db, ann.id, secret.id, { effectiveDate: "2026-11-18", values: { [diary.id]: "private" } }, new Date("2026-11-18T15:00:00Z"));
    const n = new RecordingNotifier();
    expect((await runTick(db, n, new Date("2026-11-19T18:05:00Z"))).fired).toBe(0);
    await added(ann, section.id, note.id, "2026-11-18", "2026-11-18T17:00:00Z");
    const fired = await runTick(db, n, new Date("2026-11-19T18:10:00Z"));
    expect(fired.fired).toBe(1);
    expect(JSON.stringify(n.sent)).not.toContain("private");
    expect(n.sent[0].payload.body).toBe("Fitness: 1 new entry yesterday");
  });

  it("never shows up as an overdue banner", async () => {
    const { ann, bob, jurnal, section, note } = await follow();
    await createDigestRule(db, bob.id, { jurnalId: jurnal.id });
    await backdate();
    await added(ann, section.id, note.id, "2026-11-18", "2026-11-18T15:00:00Z");
    await runTick(db, new RecordingNotifier(), new Date("2026-11-19T18:05:00Z"));
    expect(await getOverdue(db, bob.id, new Date("2026-11-19T18:10:00Z"))).toEqual([]);
  });

  it("is deleted when access is withdrawn, kept when only the alert permission is, and listed for the owner", async () => {
    const { ann, bob, jurnal } = await follow();
    await createDigestRule(db, bob.id, { jurnalId: jurnal.id });
    expect((await listAlertsOnMyJurnal(db, ann.id, jurnal.id)).map((a) => [a.followerName, a.rule.kind])).toEqual([["Bob", "follower_digest"]]);
    const [g] = await listGrants(db, ann.id, jurnal.id);
    await updateGrantOptions(db, ann.id, g.grant.id, { canAlert: false });
    expect(await listAlertsOnMyJurnal(db, ann.id, jurnal.id)).toHaveLength(1);
    await revokeGrant(db, ann.id, g.grant.id);
    expect(await listAlertsOnMyJurnal(db, ann.id, jurnal.id)).toHaveLength(0);
  });
});
