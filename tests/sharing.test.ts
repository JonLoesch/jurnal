import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { grants } from "@/db/schema";
import { addMetric, addSection, createEntry, createJurnal, exportJurnal, getFeed, getMetricSeries, updateMetric, updateSection } from "@/server/journal";
import {
  addComment,
  createInvite,
  deleteComment,
  grantProtected,
  leaveJurnal,
  listGrants,
  redeemInvite,
  revokeGrant,
  revokeInvite,
  setPublicLink,
  sharingWarnings,
  updateGrantOptions,
} from "@/server/sharing";
import { loadForViewer } from "@/server/gate";
import { makeAccount, testDb } from "./helpers";
import { invites } from "@/db/schema";

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

async function setup() {
  const ann = await makeAccount(db, "Ann");
  const bob = await makeAccount(db, "Bob");
  const carol = await makeAccount(db, "Carol");
  const jurnal = await createJurnal(db, ann.id, "Life");
  const { loaded } = await getFeed(db, jurnal.id, { accountId: ann.id });
  const open = loaded.allSections[0];
  const secret = await addSection(db, ann.id, jurnal.id, "Diary");
  await updateSection(db, ann.id, secret.id, { protected: true });
  const mood = await addMetric(db, ann.id, open.id, { name: "Mood", fieldType: "stars" });
  const hidden = await addMetric(db, ann.id, open.id, { name: "Weight", fieldType: "number", protected: true });
  const diary = await addMetric(db, ann.id, secret.id, { name: "Diary", fieldType: "text" });
  const now = new Date("2026-11-05T15:00:00Z");
  const e1 = await createEntry(db, ann.id, open.id, { values: { [mood.id]: 4, [hidden.id]: 80 } }, now);
  const e2 = await createEntry(db, ann.id, secret.id, { values: { [diary.id]: "dear diary" } }, now);
  return { ann, bob, carol, jurnal, open, secret, mood, hidden, diary, e1, e2 };
}

describe("invites", () => {
  it("is single use by default, then refuses", async () => {
    const { ann, bob, carol, jurnal } = await setup();
    const token = await createInvite(db, ann.id, jurnal.id);
    await redeemInvite(db, bob.id, token);
    await expect(redeemInvite(db, carol.id, token)).rejects.toThrow(/no longer valid/);
  });

  it("allows several uses when asked", async () => {
    const { ann, bob, carol, jurnal } = await setup();
    const token = await createInvite(db, ann.id, jurnal.id, { maxUses: 2 });
    await redeemInvite(db, bob.id, token);
    await redeemInvite(db, carol.id, token);
    expect(await listGrants(db, ann.id, jurnal.id)).toHaveLength(2);
  });

  it("expires after 7 days by default", async () => {
    const { ann, bob, jurnal } = await setup();
    const t0 = new Date("2026-11-05T12:00:00Z");
    const token = await createInvite(db, ann.id, jurnal.id, {}, t0);
    await expect(redeemInvite(db, bob.id, token, new Date("2026-11-12T12:00:01Z"))).rejects.toThrow(/no longer valid/);
    await redeemInvite(db, bob.id, token, new Date("2026-11-12T11:59:00Z"));
  });

  it("can be revoked, and stores only a hash of the token", async () => {
    const { ann, bob, jurnal } = await setup();
    const token = await createInvite(db, ann.id, jurnal.id);
    const [row] = await db.select().from(invites);
    expect(row.tokenHash).not.toContain(token);
    await revokeInvite(db, ann.id, row.id);
    await expect(redeemInvite(db, bob.id, token)).rejects.toThrow(/no longer valid/);
  });

  it("refuses the owner and bad tokens", async () => {
    const { ann, jurnal } = await setup();
    await expect(redeemInvite(db, ann.id, await createInvite(db, ann.id, jurnal.id))).rejects.toThrow(/own jurnal/);
    await expect(redeemInvite(db, ann.id, "nope")).rejects.toThrow(/no longer valid/);
  });

  it("only the owner can invite", async () => {
    const { bob, jurnal } = await setup();
    await expect(createInvite(db, bob.id, jurnal.id)).rejects.toThrow(/Not found/);
  });

  it("carries the options onto the grant", async () => {
    const { ann, bob, jurnal } = await setup();
    await redeemInvite(db, bob.id, await createInvite(db, ann.id, jurnal.id, { commentPerm: "write", canAlert: true, precision: "time" }));
    const { access } = await loadForViewer(db, jurnal.id, { accountId: bob.id });
    expect([access.commentPerm, access.canAlert, access.precision]).toEqual(["write", true, "time"]);
  });
});

describe("what a follower can see", () => {
  it("never leaks protected sections or metrics through any read path", async () => {
    const { ann, bob, jurnal, hidden, diary, e2 } = await setup();
    await redeemInvite(db, bob.id, await createInvite(db, ann.id, jurnal.id, { commentPerm: "write" }));
    const viewer = { accountId: bob.id };

    const { feed } = await getFeed(db, jurnal.id, viewer);
    const text = JSON.stringify(feed);
    expect(text).not.toContain("dear diary");
    expect(feed.flatMap((e) => e.values.map((v) => v.metricId))).not.toContain(hidden.id);
    expect(feed.map((e) => e.id)).not.toContain(e2.id);

    await expect(getMetricSeries(db, jurnal.id, hidden.id, viewer)).rejects.toThrow(/Not found/);
    await expect(getMetricSeries(db, jurnal.id, diary.id, viewer)).rejects.toThrow(/Not found/);
    const exported = JSON.stringify(await exportJurnal(db, jurnal.id, viewer));
    expect(exported).not.toContain("dear diary");
    expect(exported).not.toContain("Weight");
    await expect(addComment(db, bob.id, e2.id, "hello")).rejects.toThrow(/Not found/);
  });

  it("shows protected items once granted, and not before the jurnal grant exists", async () => {
    const { ann, bob, jurnal, secret, hidden, diary } = await setup();
    await expect(grantProtected(db, ann.id, jurnal.id, { scope: "section", scopeId: secret.id, granteeId: bob.id })).rejects.toThrow(/Share the jurnal/);
    await redeemInvite(db, bob.id, await createInvite(db, ann.id, jurnal.id));
    await grantProtected(db, ann.id, jurnal.id, { scope: "section", scopeId: secret.id, granteeId: bob.id });
    await grantProtected(db, ann.id, jurnal.id, { scope: "metric", scopeId: hidden.id, granteeId: bob.id });
    const { feed } = await getFeed(db, jurnal.id, { accountId: bob.id });
    expect(JSON.stringify(feed)).toContain("dear diary");
    expect((await getMetricSeries(db, jurnal.id, hidden.id, { accountId: bob.id })).points).toHaveLength(1);
    expect(diary.id).toBeTruthy();
  });

  it("makes strangers see nothing, not even that the jurnal exists", async () => {
    const { carol, jurnal } = await setup();
    await expect(getFeed(db, jurnal.id, { accountId: carol.id })).rejects.toThrow(/Not found/);
    await expect(getFeed(db, jurnal.id, { accountId: null })).rejects.toThrow(/Not found/);
  });

  it("removes access and their alerts when the jurnal grant is revoked", async () => {
    const { ann, bob, jurnal, secret } = await setup();
    await redeemInvite(db, bob.id, await createInvite(db, ann.id, jurnal.id));
    await grantProtected(db, ann.id, jurnal.id, { scope: "section", scopeId: secret.id, granteeId: bob.id });
    const [base] = (await listGrants(db, ann.id, jurnal.id)).filter((g) => g.grant.scope === "jurnal");
    await revokeGrant(db, ann.id, base.grant.id);
    expect(await db.select().from(grants).where(eq(grants.granteeId, bob.id))).toHaveLength(0);
    await expect(getFeed(db, jurnal.id, { accountId: bob.id })).rejects.toThrow(/Not found/);
  });

  it("lets a follower leave", async () => {
    const { ann, bob, jurnal } = await setup();
    await redeemInvite(db, bob.id, await createInvite(db, ann.id, jurnal.id));
    await leaveJurnal(db, bob.id, jurnal.id);
    await expect(getFeed(db, jurnal.id, { accountId: bob.id })).rejects.toThrow(/Not found/);
  });

  it("applies a changed precision immediately", async () => {
    const { ann, bob, jurnal } = await setup();
    await redeemInvite(db, bob.id, await createInvite(db, ann.id, jurnal.id));
    expect((await getFeed(db, jurnal.id, { accountId: bob.id })).feed[0].effectiveTime).toBeUndefined();
    const [g] = await listGrants(db, ann.id, jurnal.id);
    await updateGrantOptions(db, ann.id, g.grant.id, { precision: "time" });
    expect((await getFeed(db, jurnal.id, { accountId: bob.id })).feed[0].effectiveTime).toBeTruthy();
  });

  it("warns the owner about protected items", async () => {
    const { ann, jurnal } = await setup();
    const w = await sharingWarnings(db, ann.id, jurnal.id);
    expect(w).toEqual({ hasProtectedItems: true, protectedSections: ["Diary"], protectedMetrics: ["Weight"] });
  });
});

describe("public link", () => {
  it("shows unprotected items to anyone with the link, at day precision, and can be turned off", async () => {
    const { ann, jurnal, mood } = await setup();
    const token = await setPublicLink(db, ann.id, jurnal.id, true);
    const { feed } = await getFeed(db, jurnal.id, { accountId: null, linkToken: token });
    expect(feed).toHaveLength(1);
    expect(feed[0].values).toEqual([{ metricId: mood.id, value: 4 }]);
    expect(feed[0].effectiveTime).toBeUndefined();
    await expect(getFeed(db, jurnal.id, { accountId: null, linkToken: "wrong" })).rejects.toThrow(/Not found/);
    await setPublicLink(db, ann.id, jurnal.id, false);
    await expect(getFeed(db, jurnal.id, { accountId: null, linkToken: token })).rejects.toThrow(/Not found/);
  });

  it("does not show protection-hidden metrics even after protecting an existing one", async () => {
    const { ann, jurnal, mood } = await setup();
    const token = await setPublicLink(db, ann.id, jurnal.id, true);
    await updateMetric(db, ann.id, mood.id, { protected: true });
    const { feed } = await getFeed(db, jurnal.id, { accountId: null, linkToken: token });
    expect(feed.flatMap((e) => e.values)).toEqual([]);
  });
});

describe("comments", () => {
  it("respects the comment permission", async () => {
    const { ann, bob, carol, jurnal, e1 } = await setup();
    await redeemInvite(db, bob.id, await createInvite(db, ann.id, jurnal.id, { commentPerm: "write" }));
    await redeemInvite(db, carol.id, await createInvite(db, ann.id, jurnal.id, { commentPerm: "read" }));
    const c = await addComment(db, bob.id, e1.id, "nice work");
    await expect(addComment(db, carol.id, e1.id, "me too")).rejects.toThrow(/can't comment/);
    expect((await getFeed(db, jurnal.id, { accountId: carol.id })).feed[0].comments.map((x) => x.body)).toEqual(["nice work"]);
    await expect(deleteComment(db, carol.id, c.id)).rejects.toThrow(/Not allowed/);
    await deleteComment(db, ann.id, c.id); // the owner can remove comments on their jurnal
  });

  it("hides comments from followers with no comment permission", async () => {
    const { ann, bob, jurnal, e1 } = await setup();
    await addComment(db, ann.id, e1.id, "note to self");
    await redeemInvite(db, bob.id, await createInvite(db, ann.id, jurnal.id));
    expect((await getFeed(db, jurnal.id, { accountId: bob.id })).feed[0].comments).toEqual([]);
  });
});
