import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { assets } from "@/db/schema";
import { accountExists, addMetric, createEntry, createJurnal, deleteAccount, getFeed, listMyJurnals } from "@/server/journal";
import { createAbsenceRule } from "@/server/alerts";
import { createInvite, redeemInvite } from "@/server/sharing";
import { makeAccount, testDb } from "./helpers";

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

const count = async (table: string) => Number((await db.execute(sql.raw(`select count(*)::int as n from "${table}"`))).rows[0].n);

async function world() {
  const ann = await makeAccount(db, "Ann");
  const bob = await makeAccount(db, "Bob");
  const annJ = await createJurnal(db, ann.id, "Ann fitness");
  const bobJ = await createJurnal(db, bob.id, "Bob chess");
  const { loaded } = await getFeed(db, annJ.id, { accountId: ann.id });
  const section = loaded.allSections[0];
  const note = await addMetric(db, ann.id, section.id, { name: "Note", fieldType: "richtext" });
  const entry = await createEntry(db, ann.id, section.id, { values: { [note.id]: { text: "hi", assetIds: [] } } }, new Date("2026-11-05T15:00:00Z"));
  await db.insert(assets).values({ entryId: entry.id, metricId: note.id, storageKey: "photo-1", contentType: "image/png", bytes: 3 });
  await redeemInvite(db, bob.id, await createInvite(db, ann.id, annJ.id, { canAlert: true }));
  await createAbsenceRule(db, bob.id, { jurnalId: annJ.id, days: 2 });
  return { ann, bob, annJ, bobJ };
}

describe("deleteAccount", () => {
  it("removes the account, its jurnals, photos, and what others held on them", async () => {
    const { ann, bob, bobJ } = await world();
    const removed: string[] = [];
    await deleteAccount(db, { delete: async (k) => void removed.push(k) }, ann.id);

    expect(await accountExists(db, ann.id)).toBe(false);
    expect(removed).toEqual(["photo-1"]);
    for (const t of ["entry", "entry_value", "asset", "grant", "reminder_rule", "invite"]) expect(await count(t)).toBe(0);
    // Bob and his own jurnal are untouched.
    expect(await accountExists(db, bob.id)).toBe(true);
    expect((await listMyJurnals(db, bob.id)).map((x) => x.id)).toEqual([bobJ.id]);
  });

  it("removes a follower's grant and rules but leaves the owner's data", async () => {
    const { ann, bob, annJ } = await world();
    await deleteAccount(db, { delete: async () => {} }, bob.id);

    expect(await accountExists(db, bob.id)).toBe(false);
    expect(await count("grant")).toBe(0);
    expect(await count("reminder_rule")).toBe(0);
    expect((await listMyJurnals(db, ann.id)).map((x) => x.id)).toEqual([annJ.id]);
    expect(await count("entry")).toBe(1);
  });

  it("still deletes the account when a photo file can't be removed", async () => {
    const { ann } = await world();
    await deleteAccount(db, { delete: async () => Promise.reject(new Error("storage down")) }, ann.id);
    expect(await accountExists(db, ann.id)).toBe(false);
  });
});
