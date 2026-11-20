import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../src/db/client";
import { accounts, entries } from "../src/db/schema";
import { createEntry, listMyJurnals } from "../src/server/journal";
import { requireOwner } from "../src/server/gate";

/**
 * One-off import of entries from a JSON plan file kept OUTSIDE the repo (it is personal data).
 *
 *   tsx scripts/import-entries.ts plan.json [--apply]
 *
 * Without --apply it prints what it would do and writes nothing. It refuses to touch a section and day
 * that already has an entry. Plan shape:
 *   { "account": "you@example.com", "entries": [
 *       { "jurnal": "Fitness", "section": "Activity", "date": "2026-11-19", "time": "17:45",
 *         "values": { "Diet": { "lines": [{ "at": "2026-11-19T18:23:00Z", "text": "..." }] },
 *                     "Ex1.1 Barbell Squat": [{ "reps": 10, "weight": 165 }], "Notes": { "text": "..." } } } ] }
 * Photos are not handled here (they need the Blob store); lines import as text.
 */
type Plan = { account: string; entries: { jurnal: string; section: string; date: string; time?: string; values: Record<string, unknown> }[] };

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) throw new Error("Usage: tsx scripts/import-entries.ts plan.json [--apply]");
  const apply = flag === "--apply";
  const plan = JSON.parse(readFileSync(file, "utf8")) as Plan;
  const db = getDb();
  const [account] = await db.select().from(accounts).where(eq(accounts.email, plan.account.toLowerCase()));
  if (!account) throw new Error(`No account for ${plan.account}`);
  const myJurnals = await listMyJurnals(db, account.id);

  const prepared: { sectionId: string; label: string; date: string; time?: string; values: Record<string, unknown> }[] = [];
  for (const e of plan.entries) {
    const jurnal = myJurnals.find((j) => j.name === e.jurnal);
    if (!jurnal) throw new Error(`No jurnal "${e.jurnal}"`);
    const { allSections, allMetrics } = await requireOwner(db, account.id, jurnal.id);
    const section = allSections.find((s) => !s.isDefault && s.name === e.section);
    if (!section) throw new Error(`No section "${e.section}" in ${e.jurnal}`);
    const existing = await db.select({ id: entries.id }).from(entries).where(and(eq(entries.sectionId, section.id), eq(entries.effectiveDate, e.date)));
    if (existing.length) throw new Error(`${e.jurnal} / ${e.section} already has an entry on ${e.date}; not touching it`);
    const values: Record<string, unknown> = {};
    for (const [name, raw] of Object.entries(e.values)) {
      const m = allMetrics.find((x) => x.sectionId === section.id && x.name === name && !x.archivedAt);
      if (!m) throw new Error(`No metric "${name}" in ${e.jurnal} / ${e.section}`);
      if (m.fieldType === "log") {
        const lines = (raw as { lines: { at: string; text: string }[] }).lines;
        values[m.id] = { lines: lines.map((l) => ({ id: randomUUID(), at: new Date(l.at).toISOString(), text: l.text, assetIds: [] })) };
      } else values[m.id] = raw;
    }
    prepared.push({ sectionId: section.id, label: `${e.jurnal} / ${e.section}`, date: e.date, time: e.time, values });
  }

  for (const p of prepared) {
    console.log(`${apply ? "WRITE" : "would write"}: ${p.label}  ${p.date}${p.time ? " " + p.time : ""}  (${Object.keys(p.values).length} fields)`);
    if (apply) await createEntry(db, account.id, p.sectionId, { effectiveDate: p.date, effectiveTime: p.time, values: p.values });
  }
  console.log(apply ? `Done: ${prepared.length} entries.` : "Dry run only. Add --apply to write.");
  await db.pool.end();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
