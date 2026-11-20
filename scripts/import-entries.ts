import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../src/db/client";
import { accounts, assets, entries, entryValues } from "../src/db/schema";
import { createEntry, listMyJurnals } from "../src/server/journal";
import { checkValue } from "../src/lib/fieldtypes";
import { requireOwner } from "../src/server/gate";
import { storage } from "../src/server/storage";

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
 * A line may carry "photos": ["/path/a.jpg"]. They are shrunk (ImageMagick) and stored the way the app stores
 * them: in Vercel Blob if BLOB_READ_WRITE_TOKEN is set, else on local disk.
 */
type Plan = { account: string; entries: { jurnal: string; section: string; date: string; time?: string; values: Record<string, unknown> }[] };
type PlanLine = { at: string; text: string; photos?: string[] };
type Prepared = { sectionId: string; label: string; date: string; time?: string; values: Record<string, unknown>; photos: { metricId: string; lineId: string; file: string }[] };

const tmp = mkdtempSync(path.join(tmpdir(), "jurnal-import-"));
function shrink(file: string, n: number) {
  const out = path.join(tmp, `${n}.jpg`);
  execFileSync("convert", [file, "-auto-orient", "-resize", "1600x1600>", "-quality", "82", out]);
  return out;
}

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) throw new Error("Usage: tsx scripts/import-entries.ts plan.json [--apply]");
  const apply = flag === "--apply";
  const plan = JSON.parse(readFileSync(file, "utf8")) as Plan;
  const db = getDb();
  const [account] = await db.select().from(accounts).where(eq(accounts.email, plan.account.toLowerCase()));
  if (!account) throw new Error(`No account for ${plan.account}`);
  const myJurnals = await listMyJurnals(db, account.id);

  const prepared: Prepared[] = [];
  for (const e of plan.entries) {
    const jurnal = myJurnals.find((j) => j.name === e.jurnal);
    if (!jurnal) throw new Error(`No jurnal "${e.jurnal}"`);
    const { allSections, allMetrics } = await requireOwner(db, account.id, jurnal.id);
    const section = allSections.find((s) => !s.isDefault && s.name === e.section);
    if (!section) throw new Error(`No section "${e.section}" in ${e.jurnal}`);
    const existing = await db.select({ id: entries.id }).from(entries).where(and(eq(entries.sectionId, section.id), eq(entries.effectiveDate, e.date)));
    if (existing.length) throw new Error(`${e.jurnal} / ${e.section} already has an entry on ${e.date}; not touching it`);
    const values: Record<string, unknown> = {};
    const photos: Prepared["photos"] = [];
    for (const [name, raw] of Object.entries(e.values)) {
      const m = allMetrics.find((x) => x.sectionId === section.id && x.name === name && !x.archivedAt);
      if (!m) throw new Error(`No metric "${name}" in ${e.jurnal} / ${e.section}`);
      if (m.fieldType === "log") {
        const lines = (raw as { lines: PlanLine[] }).lines;
        values[m.id] = {
          lines: lines.map((l) => {
            const id = randomUUID();
            for (const file of l.photos ?? []) {
              statSync(file); // fail now, not halfway through
              photos.push({ metricId: m.id, lineId: id, file });
            }
            return { id, at: new Date(l.at).toISOString(), text: l.text, assetIds: [] as string[] };
          }),
        };
      } else {
        // Check every value now, so a bad plan fails in the dry run and not halfway through writing.
        const r = checkValue(m.fieldType, m.config, raw);
        if (!r.ok) throw new Error(`${e.jurnal} / ${e.section} / ${name}: ${r.error}`);
        values[m.id] = raw;
      }
    }
    prepared.push({ sectionId: section.id, label: `${e.jurnal} / ${e.section}`, date: e.date, time: e.time, values, photos });
  }

  for (const p of prepared) {
    console.log(`${apply ? "WRITE" : "would write"}: ${p.label}  ${p.date}${p.time ? " " + p.time : ""}  (${Object.keys(p.values).length} fields, ${p.photos.length} photos)`);
    if (!apply) continue;
    const entry = await createEntry(db, account.id, p.sectionId, { effectiveDate: p.date, effectiveTime: p.time ?? null, values: p.values });
    // Photos: store the file, record it as an asset of the entry, and point its log line at it.
    const touched = new Set<string>(); // log metrics that got photos
    const byLine = new Map<string, { metricId: string; ids: string[] }>();
    let n = 0;
    for (const ph of p.photos) {
      const small = shrink(ph.file, n++);
      const key = randomUUID();
      const bytes = new Uint8Array(readFileSync(small));
      await storage.put(key, bytes);
      const [a] = await db.insert(assets).values({ entryId: entry.id, metricId: ph.metricId, storageKey: key, contentType: "image/jpeg", bytes: bytes.length }).returning();
      const cur = byLine.get(ph.lineId) ?? { metricId: ph.metricId, ids: [] };
      cur.ids.push(a.id);
      byLine.set(ph.lineId, cur);
      touched.add(ph.metricId);
    }
    for (const metricId of touched) {
      const [row] = await db.select().from(entryValues).where(and(eq(entryValues.entryId, entry.id), eq(entryValues.metricId, metricId)));
      const value = row.value as { lines: { id: string; assetIds: string[] }[] };
      value.lines = value.lines.map((l) => ({ ...l, assetIds: byLine.get(l.id)?.ids ?? l.assetIds }));
      await db.update(entryValues).set({ value }).where(and(eq(entryValues.entryId, entry.id), eq(entryValues.metricId, metricId)));
    }
  }
  console.log(apply ? `Done: ${prepared.length} entries.` : "Dry run only. Add --apply to write.");
  await db.pool.end();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
