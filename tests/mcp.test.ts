import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { addMetric, appendLogLine, createJurnal, getFeed } from "@/server/journal";
import { storage } from "@/server/storage";
import { sql } from "drizzle-orm";
import { createInvite, redeemInvite } from "@/server/sharing";
import { createToken } from "@/server/tokens";
import { makeAccount, testDb } from "./helpers";

// The route builds its own connection from DATABASE_URL, so point it at the test database before it loads.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://jurnal@localhost:54329/jurnal_test";

let db: Db;
let POST: (req: Request) => Promise<Response>;
beforeAll(async () => {
  ({ POST } = await import("@/app/api/[transport]/route"));
});
beforeEach(async () => {
  db = await testDb();
});

let rpcId = 0;
async function rpc(token: string | null, method: string, params: unknown = {}) {
  const res = await POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    }),
  );
  const text = await res.text();
  const data = text.startsWith("event:") || text.includes("\ndata:") ? text.split("\n").find((l) => l.startsWith("data:"))!.slice(5) : text;
  return { status: res.status, body: res.status === 200 ? JSON.parse(data) : null };
}

async function call(token: string | null, name: string, args: Record<string, unknown> = {}) {
  const { status, body } = await rpc(token, "tools/call", { name, arguments: args });
  if (status !== 200) return { status } as { status: number; isError?: boolean; data?: unknown; text?: string };
  const r = body.result ?? { isError: true, content: [{ text: body.error?.message }] };
  const text = r.content?.[0]?.text as string;
  let data: unknown;
  try { data = JSON.parse(text); } catch { /* an error message */ }
  return { status, isError: !!r.isError, data, text };
}

async function world() {
  const ann = await makeAccount(db, "Ann");
  const jurnal = await createJurnal(db, ann.id, "Fitness");
  const { loaded } = await getFeed(db, jurnal.id, { accountId: ann.id });
  const section = loaded.allSections[0];
  const diet = await addMetric(db, ann.id, section.id, { name: "Diet", fieldType: "log" });
  const weight = await addMetric(db, ann.id, section.id, { name: "Weight", fieldType: "number", config: { unit: "kg" } });
  return { ann, jurnal, section, diet, weight };
}

describe("MCP endpoint", () => {
  it("refuses requests without a valid token", async () => {
    expect((await rpc(null, "tools/list")).status).toBe(401);
    expect((await rpc("jt_nope", "tools/list")).status).toBe(401);
  });

  it("lists tools and reads with a read token", async () => {
    const { ann, jurnal, diet } = await world();
    const { token } = await createToken(db, ann.id, { name: "r", scopes: [] });
    const tools = (await rpc(token, "tools/list")).body.result.tools.map((t: { name: string }) => t.name);
    expect(tools).toEqual(expect.arrayContaining(["list_jurnals", "get_entries", "append_log_line", "add_metric"]));

    const list = await call(token, "list_jurnals");
    expect((list.data as { owned: { name: string }[] }).owned.map((j) => j.name)).toEqual(["Fitness"]);
    const structure = await call(token, "get_jurnal", { jurnalId: jurnal.id });
    expect(JSON.stringify(structure.data)).toContain(diet.id);
  });

  it("a read-only token can't write", async () => {
    const { ann, diet } = await world();
    const { token } = await createToken(db, ann.id, { name: "r", scopes: [] });
    const r = await call(token, "append_log_line", { metricId: diet.id, text: "nope" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('"entries" permission');
    expect((await call(token, "create_jurnal", { name: "x" })).text).toContain('"settings" permission');
  });

  it("an entries token logs lines and entries, and what it wrote reads back", async () => {
    const { ann, jurnal, section, diet, weight } = await world();
    const { token } = await createToken(db, ann.id, { name: "w", scopes: ["entries"] });
    const a = await call(token, "append_log_line", { metricId: diet.id, text: "oatmeal and raspberries" });
    expect(a.isError).toBeFalsy();
    await call(token, "create_entry", { sectionId: section.id, values: { [weight.id]: 80.5 }, date: "2026-11-01" });
    const bad = await call(token, "create_entry", { sectionId: section.id, values: { [weight.id]: "heavy" } });
    expect(bad.isError).toBe(true);

    const entries = (await call(token, "get_entries", { jurnalId: jurnal.id })).data as { date: string; values: Record<string, unknown> }[];
    const logged = entries.find((e) => e.values.Diet)!;
    expect((logged.values.Diet as { text: string }[])[0].text).toBe("oatmeal and raspberries");
    expect(entries.find((e) => e.date === "2026-11-01")?.values.Weight).toBe(80.5);
    expect((await call(token, "get_entries", { jurnalId: jurnal.id, from: "2026-11-15" })).data).toHaveLength(1);
  });

  it("a settings token builds structure", async () => {
    const { ann } = await world();
    const { token } = await createToken(db, ann.id, { name: "s", scopes: ["settings"] });
    const j = (await call(token, "create_jurnal", { name: "Habits" })).data as { id: string };
    const s = (await call(token, "add_section", { jurnalId: j.id, name: "Morning", schedule: { count: 1, period: "day" } })).data as { id: string };
    const m = (await call(token, "add_metric", { sectionId: s.id, name: "Stretched", fieldType: "yesno" })).data as { id: string };
    const structure = JSON.stringify((await call(token, "get_jurnal", { jurnalId: j.id })).data);
    expect(structure).toContain("Morning");
    expect(structure).toContain(m.id);
    expect((await call(token, "add_metric", { sectionId: s.id, name: "bad", fieldType: "choice" })).isError).toBe(true); // choices missing
  });

  it("is limited to what the token's owner may see: a follower sees no protected items and can't write", async () => {
    const { ann, jurnal, diet } = await world();
    const bob = await makeAccount(db, "Bob");
    await redeemInvite(db, bob.id, await createInvite(db, ann.id, jurnal.id));
    await db.execute(sqlProtect(diet.id));
    const t = await createToken(db, bob.id, { name: "bob", scopes: ["entries", "settings"] });
    const seen = JSON.stringify((await call(t.token, "get_jurnal", { jurnalId: jurnal.id })).data);
    expect(seen).not.toContain(diet.id);
    expect((await call(t.token, "append_log_line", { metricId: diet.id, text: "hi" })).isError).toBe(true); // not the owner
    expect((await call(t.token, "add_metric", { sectionId: seenSection(seen), name: "x", fieldType: "text" })).isError).toBe(true);
    const carol = await makeAccount(db, "Carol");
    const c = await createToken(db, carol.id, { name: "c", scopes: [] });
    expect((await call(c.token, "get_jurnal", { jurnalId: jurnal.id })).isError).toBe(true);
  });
});

const sqlProtect = (metricId: string) => sql`update metric set protected = true where id = ${metricId}`;
const seenSection = (structure: string) => (JSON.parse(structure) as { sections: { id: string }[] }).sections[0].id;

describe("MCP photos", () => {
  async function withPhoto() {
    const { ann, jurnal, diet } = await world();
    const { token } = await createToken(db, ann.id, { name: "r", scopes: [] });
    const key = crypto.randomUUID();
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]); // not a real PNG; the bytes just have to round-trip
    await storage.put(key, bytes);
    const { entryId, line } = await appendLogLine(db, ann.id, diet.id, { text: "lunch", photos: [{ key, contentType: "image/png", bytes: bytes.length }] });
    return { ann, jurnal, token, bytes, entryId, photoId: line.assetIds[0], diet };
  }

  it("lists a photo's id in the entries and returns the image itself", async () => {
    const { jurnal, token, bytes, photoId } = await withPhoto();
    const entries = (await call(token, "get_entries", { jurnalId: jurnal.id })).data as { values: Record<string, { photoIds: string[] }[]> }[];
    expect(entries[0].values.Diet[0].photoIds).toEqual([photoId]);

    const { body } = await rpc(token, "tools/call", { name: "get_photo", arguments: { photoId } });
    const image = body.result.content[0];
    expect(image.type).toBe("image");
    expect(image.mimeType).toBe("image/png");
    expect(Array.from(Buffer.from(image.data, "base64"))).toEqual(Array.from(bytes));
  });

  it("won't hand a photo to someone who can't see its metric, or to a stranger", async () => {
    const { ann, jurnal, diet, photoId } = await withPhoto();
    const bob = await makeAccount(db, "Bob");
    await redeemInvite(db, bob.id, await createInvite(db, ann.id, jurnal.id));
    const b = await createToken(db, bob.id, { name: "b", scopes: [] });
    expect((await rpc(b.token, "tools/call", { name: "get_photo", arguments: { photoId } })).body.result.content[0].type).toBe("image"); // followers see unprotected photos

    await db.execute(sql`update metric set protected = true where id = ${diet.id}`);
    const hidden = await rpc(b.token, "tools/call", { name: "get_photo", arguments: { photoId } });
    expect(hidden.body.result.isError).toBe(true);
    const carol = await makeAccount(db, "Carol");
    const c = await createToken(db, carol.id, { name: "c", scopes: [] });
    expect((await rpc(c.token, "tools/call", { name: "get_photo", arguments: { photoId } })).body.result.isError).toBe(true);
  });
});
