import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { createToken, listTokens, revokeToken, verifyToken } from "@/server/tokens";
import { makeAccount, testDb } from "./helpers";

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

const now = new Date("2026-11-20T12:00:00Z");

describe("api tokens", () => {
  it("shows the token once, stores only a hash, and verifies it", async () => {
    const ann = await makeAccount(db, "Ann");
    const { token, row } = await createToken(db, ann.id, { name: "Claude Code", scopes: ["entries"] }, now);
    expect(token).toMatch(/^jt_[\w-]{40,}$/);
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.scopes).toEqual(["read", "entries"]); // writing implies reading
    expect(await verifyToken(db, token, now)).toMatchObject({ accountId: ann.id, scopes: ["read", "entries"] });
    expect(await verifyToken(db, token + "x", now)).toBeNull();
    expect(await verifyToken(db, undefined, now)).toBeNull();
    expect(await verifyToken(db, "not-a-token", now)).toBeNull();
  });

  it("expires after a year by default and honors a shorter expiry", async () => {
    const ann = await makeAccount(db, "Ann");
    const year = await createToken(db, ann.id, { name: "default", scopes: [] }, now);
    expect(year.row.expiresAt.toISOString()).toBe("2027-11-20T12:00:00.000Z");
    const week = await createToken(db, ann.id, { name: "short", scopes: [], days: 7 }, now);
    expect(await verifyToken(db, week.token, new Date("2026-11-26T12:00:00Z"))).not.toBeNull();
    expect(await verifyToken(db, week.token, new Date("2026-11-28T12:00:00Z"))).toBeNull();
    expect(await verifyToken(db, year.token, new Date("2027-11-19T12:00:00Z"))).not.toBeNull();
    expect(await verifyToken(db, year.token, new Date("2027-11-21T12:00:00Z"))).toBeNull();
    await expect(createToken(db, ann.id, { name: "x", scopes: [], days: 0 }, now)).rejects.toThrow(/Expiry/);
  });

  it("can be revoked, only by its owner", async () => {
    const ann = await makeAccount(db, "Ann");
    const bob = await makeAccount(db, "Bob");
    const { token, row } = await createToken(db, ann.id, { name: "t", scopes: [] }, now);
    await expect(revokeToken(db, bob.id, row.id)).rejects.toThrow(/Not found/);
    await revokeToken(db, ann.id, row.id, now);
    expect(await verifyToken(db, token, now)).toBeNull();
    expect((await listTokens(db, ann.id))[0].revokedAt).not.toBeNull();
  });

  it("needs a name, rejects unknown permissions, and is deleted with the account", async () => {
    const ann = await makeAccount(db, "Ann");
    await expect(createToken(db, ann.id, { name: " ", scopes: [] })).rejects.toThrow(/Name/);
    await expect(createToken(db, ann.id, { name: "x", scopes: ["root" as never] })).rejects.toThrow(/Unknown/);
    await createToken(db, ann.id, { name: "t", scopes: [] });
    await db.execute(sql`delete from account where id = ${ann.id}`);
    expect(await listTokens(db, ann.id)).toEqual([]);
  });
});
