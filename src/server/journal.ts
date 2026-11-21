import { and, asc, desc, eq, inArray, lte, notInArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  accounts,
  assets,
  comments,
  entries,
  entryValues,
  jurnals,
  metrics,
  owners,
  sections,
  type FieldType,
  type Precision,
  type Schedule,
} from "@/db/schema";
import { viewEntries, viewValue } from "@/lib/access";
import { checkValue, validateConfig, type LogLine } from "@/lib/fieldtypes";
import { validateSchedule } from "@/lib/frequency";
import { dateIn, isDate, isHHMM, isValidTimezone, timeIn } from "@/lib/time";
import { UserError, forbidden, notFound } from "./errors";
import { loadForViewer, requireOwner, type Viewer } from "./gate";

// ---------- accounts and jurnals ----------

export async function upsertAccount(db: Db, input: { email: string; name: string }) {
  const email = input.email.trim().toLowerCase();
  const [existing] = await db.select().from(accounts).where(eq(accounts.email, email));
  if (existing) return existing;
  return db.transaction(async (tx) => {
    const [account] = await tx.insert(accounts).values({ email, name: input.name.trim() || email }).returning();
    await tx.insert(owners).values({ kind: "account", accountId: account.id });
    return account;
  });
}

export async function accountExists(db: Db, id: string) {
  const [row] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, id));
  return !!row;
}

export async function updateAccountSettings(
  db: Db,
  accountId: string,
  s: { timezone?: string; weekStart?: number; name?: string },
) {
  if (s.timezone !== undefined && !isValidTimezone(s.timezone)) throw new UserError("Unknown timezone");
  if (s.weekStart !== undefined && (!Number.isInteger(s.weekStart) || s.weekStart < 1 || s.weekStart > 7))
    throw new UserError("Week must start on a day from 1 to 7");
  await db.update(accounts).set({ ...s }).where(eq(accounts.id, accountId));
}

export async function createJurnal(db: Db, accountId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new UserError("Give the jurnal a name");
  const [owner] = await db.select().from(owners).where(eq(owners.accountId, accountId));
  if (!owner) throw forbidden();
  return db.transaction(async (tx) => {
    const [jurnal] = await tx.insert(jurnals).values({ ownerId: owner.id, name: trimmed }).returning();
    await tx.insert(sections).values({ jurnalId: jurnal.id, name: "Entries", isDefault: true });
    return jurnal;
  });
}

export async function listMyJurnals(db: Db, accountId: string) {
  return db
    .select({ jurnal: jurnals })
    .from(jurnals)
    .innerJoin(owners, eq(owners.id, jurnals.ownerId))
    .where(and(eq(owners.accountId, accountId), sql`${jurnals.archivedAt} is null`))
    .orderBy(asc(jurnals.createdAt))
    .then((rows) => rows.map((r) => r.jurnal));
}

export async function updateJurnal(
  db: Db,
  accountId: string,
  jurnalId: string,
  patch: { name?: string; defaultPrecision?: Precision; archived?: boolean },
) {
  await requireOwner(db, accountId, jurnalId);
  const set: Partial<typeof jurnals.$inferInsert> = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new UserError("Give the jurnal a name");
    set.name = patch.name.trim();
  }
  if (patch.defaultPrecision) set.defaultPrecision = patch.defaultPrecision;
  if (patch.archived !== undefined) set.archivedAt = patch.archived ? new Date() : null;
  if (Object.keys(set).length) await db.update(jurnals).set(set).where(eq(jurnals.id, jurnalId));
}

// ---------- sections and metrics ----------

export async function addSection(db: Db, accountId: string, jurnalId: string, name: string) {
  const { allSections } = await requireOwner(db, accountId, jurnalId);
  if (!name.trim()) throw new UserError("Give the section a name");
  const [s] = await db
    .insert(sections)
    .values({ jurnalId, name: name.trim(), position: allSections.length })
    .returning();
  return s;
}

export async function updateSection(
  db: Db,
  accountId: string,
  sectionId: string,
  patch: { name?: string; protected?: boolean; schedule?: Schedule | null; archived?: boolean },
) {
  const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
  if (!section) throw notFound();
  await requireOwner(db, accountId, section.jurnalId);
  const set: Partial<typeof sections.$inferInsert> = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new UserError("Give the section a name");
    set.name = patch.name.trim();
  }
  if (patch.protected !== undefined) {
    if (section.isDefault && patch.protected) throw new UserError("Add a section for protected metrics instead");
    set.protected = patch.protected;
  }
  if (patch.schedule !== undefined) {
    if (patch.schedule) {
      const err = validateSchedule(patch.schedule);
      if (err) throw new UserError(err);
    }
    set.schedule = patch.schedule;
  }
  if (patch.archived !== undefined) {
    if (section.isDefault) throw new UserError("The default section can't be archived");
    set.archivedAt = patch.archived ? new Date() : null;
  }
  if (Object.keys(set).length) await db.update(sections).set(set).where(eq(sections.id, sectionId));
}

export async function addMetric(
  db: Db,
  accountId: string,
  sectionId: string,
  input: { name: string; fieldType: FieldType; config?: Record<string, unknown>; protected?: boolean },
) {
  const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
  if (!section) throw notFound();
  await requireOwner(db, accountId, section.jurnalId);
  if (!input.name.trim()) throw new UserError("Give the metric a name");
  const config = input.config ?? {};
  const err = validateConfig(input.fieldType, config);
  if (err) throw new UserError(err);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(metrics).where(eq(metrics.sectionId, sectionId));
  const [m] = await db
    .insert(metrics)
    .values({
      sectionId,
      name: input.name.trim(),
      fieldType: input.fieldType,
      config,
      protected: !!input.protected,
      position: n,
    })
    .returning();
  return m;
}

export async function updateMetric(
  db: Db,
  accountId: string,
  metricId: string,
  patch: { name?: string; protected?: boolean; archived?: boolean; config?: Record<string, unknown>; fieldType?: FieldType },
) {
  const [row] = await db
    .select({ metric: metrics, jurnalId: sections.jurnalId })
    .from(metrics)
    .innerJoin(sections, eq(sections.id, metrics.sectionId))
    .where(eq(metrics.id, metricId));
  if (!row) throw notFound();
  await requireOwner(db, accountId, row.jurnalId);
  const set: Partial<typeof metrics.$inferInsert> = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new UserError("Give the metric a name");
    set.name = patch.name.trim();
  }
  if (patch.protected !== undefined) set.protected = patch.protected;
  if (patch.config !== undefined) {
    const err = validateConfig(row.metric.fieldType, patch.config);
    if (err) throw new UserError(err);
    set.config = patch.config;
  }
  // Short text can grow into notes (multi-line, with photos); existing values become the note text.
  const toNotes = patch.fieldType === "richtext" && row.metric.fieldType === "text";
  if (patch.fieldType !== undefined && patch.fieldType !== row.metric.fieldType && !toNotes)
    throw new UserError("Only short text can be changed to notes");
  if (toNotes) set.fieldType = "richtext";
  // Archiving hides the metric from new entries; its values stay and remain chartable.
  if (patch.archived !== undefined) set.archivedAt = patch.archived ? new Date() : null;
  await db.transaction(async (tx) => {
    if (Object.keys(set).length) await tx.update(metrics).set(set).where(eq(metrics.id, metricId));
    if (toNotes)
      await tx
        .update(entryValues)
        .set({ value: sql`jsonb_build_object('text', ${entryValues.value} #>> '{}', 'assetIds', '[]'::jsonb)` })
        .where(and(eq(entryValues.metricId, metricId), sql`jsonb_typeof(${entryValues.value}) = 'string'`));
  });
}

// ---------- entries ----------

export type EntryInput = {
  effectiveDate?: string;
  effectiveTime?: string | null;
  values: Record<string, unknown>;
};

async function checkedValues(db: Db, sectionId: string, values: Record<string, unknown>) {
  const sectionMetrics = await db.select().from(metrics).where(eq(metrics.sectionId, sectionId));
  const byId = new Map(sectionMetrics.map((m) => [m.id, m]));
  const out: { metricId: string; value: unknown; num: number | null }[] = [];
  for (const [metricId, raw] of Object.entries(values)) {
    if (raw === null || raw === undefined || raw === "") continue; // blank = not answered
    const m = byId.get(metricId);
    if (!m) throw new UserError("That metric isn't in this section");
    if (m.archivedAt) throw new UserError(`"${m.name}" is archived`);
    const r = checkValue(m.fieldType, m.config, raw);
    if (!r.ok) throw new UserError(`${m.name}: ${r.error}`);
    out.push({ metricId, value: r.value, num: r.num });
  }
  return out;
}

function resolveWhen(tz: string, now: Date, input: Pick<EntryInput, "effectiveDate" | "effectiveTime">) {
  const today = dateIn(tz, now);
  const date = input.effectiveDate ?? today;
  if (!isDate(date)) throw new UserError("That isn't a valid date");
  if (date > today) throw new UserError("Entries can't be dated in the future");
  let time: string | null;
  if (input.effectiveTime !== undefined) {
    if (input.effectiveTime !== null && !isHHMM(input.effectiveTime)) throw new UserError("Time should look like 07:30");
    time = input.effectiveTime;
  } else {
    time = date === today ? timeIn(tz, now) : null;
  }
  return { date, time };
}

export async function createEntry(db: Db, accountId: string, sectionId: string, input: EntryInput, now = new Date()) {
  const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
  if (!section) throw notFound();
  const { subject } = await requireOwner(db, accountId, section.jurnalId);
  if (section.archivedAt) throw new UserError("That section is archived");
  const { date, time } = resolveWhen(subject.timezone, now, input);
  const vals = await checkedValues(db, sectionId, input.values);
  if (vals.length === 0) throw new UserError("Fill in at least one field");
  // A once-a-day section has one entry per day: saving again fills in or changes that entry, never a second one.
  const sch = section.schedule;
  if (!sch || (sch.period === "day" && sch.count === 1 && !sch.times)) {
    const [existing] = await db
      .select()
      .from(entries)
      .where(and(eq(entries.sectionId, sectionId), eq(entries.effectiveDate, date)))
      .orderBy(asc(entries.addedAt))
      .limit(1);
    if (existing) {
      await db.transaction(async (tx) => {
        const old = await tx.select().from(entryValues).where(eq(entryValues.entryId, existing.id));
        for (const v of vals) {
          const prev = old.find((o) => o.metricId === v.metricId)?.value as { assetIds?: string[] } | undefined;
          const value =
            prev?.assetIds?.length && v.value && typeof v.value === "object" && "text" in v.value
              ? { ...v.value, assetIds: prev.assetIds }
              : v.value;
          await tx
            .insert(entryValues)
            .values({ entryId: existing.id, metricId: v.metricId, value, valueNum: v.num })
            .onConflictDoUpdate({ target: [entryValues.entryId, entryValues.metricId], set: { value, valueNum: v.num } });
        }
        await tx.update(entries).set({ updatedAt: now }).where(eq(entries.id, existing.id));
      });
      return existing;
    }
  }
  return db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(entries)
      .values({ sectionId, authorId: accountId, effectiveDate: date, effectiveTime: time, addedAt: now, updatedAt: now })
      .returning();
    await tx.insert(entryValues).values(vals.map((v) => ({ entryId: entry.id, metricId: v.metricId, value: v.value, valueNum: v.num })));
    return entry;
  });
}

async function ownedEntry(db: Db, accountId: string, entryId: string) {
  const [row] = await db
    .select({ entry: entries, section: sections })
    .from(entries)
    .innerJoin(sections, eq(sections.id, entries.sectionId))
    .where(eq(entries.id, entryId));
  if (!row) throw notFound();
  const loaded = await requireOwner(db, accountId, row.section.jurnalId);
  return { ...row, subject: loaded.subject };
}

export async function updateEntry(db: Db, accountId: string, entryId: string, input: EntryInput, now = new Date()) {
  const { entry, subject } = await ownedEntry(db, accountId, entryId);
  const when =
    input.effectiveDate !== undefined || input.effectiveTime !== undefined
      ? resolveWhen(subject.timezone, now, {
          effectiveDate: input.effectiveDate ?? entry.effectiveDate,
          effectiveTime: input.effectiveTime !== undefined ? input.effectiveTime : entry.effectiveTime,
        })
      : { date: entry.effectiveDate, time: entry.effectiveTime };
  const vals = await checkedValues(db, entry.sectionId, input.values);
  // Running logs are added to line by line, never replaced by an edit form, so an edit leaves them alone.
  const logIds = (await db.select({ id: metrics.id }).from(metrics).where(and(eq(metrics.sectionId, entry.sectionId), eq(metrics.fieldType, "log"))))
    .map((m) => m.id)
    .filter((id) => !vals.some((v) => v.metricId === id));
  if (vals.length === 0 && !(logIds.length && (await db.select({ id: entryValues.metricId }).from(entryValues).where(and(eq(entryValues.entryId, entryId), inArray(entryValues.metricId, logIds)))).length))
    throw new UserError("Fill in at least one field");
  await db.transaction(async (tx) => {
    await tx
      .update(entries)
      .set({ effectiveDate: when.date, effectiveTime: when.time, updatedAt: now })
      .where(eq(entries.id, entryId));
    await tx.delete(entryValues).where(and(eq(entryValues.entryId, entryId), logIds.length ? notInArray(entryValues.metricId, logIds) : undefined));
    if (vals.length) await tx.insert(entryValues).values(vals.map((v) => ({ entryId, metricId: v.metricId, value: v.value, valueNum: v.num })));
  });
}

type LogValue = { lines: LogLine[] };

/**
 * Add a timestamped line to a running-log metric, on the day's entry for its section (created if there isn't
 * one yet). Photos are already in storage; their rows are created here, inside the same transaction.
 */
export async function appendLogLine(
  db: Db,
  accountId: string,
  metricId: string,
  input: { text: string; photos?: { key: string; contentType: string; bytes: number }[]; effectiveDate?: string },
  now = new Date(),
) {
  const [m] = await db
    .select({ metric: metrics, section: sections })
    .from(metrics)
    .innerJoin(sections, eq(sections.id, metrics.sectionId))
    .where(eq(metrics.id, metricId));
  if (!m) throw notFound();
  const { subject } = await requireOwner(db, accountId, m.section.jurnalId);
  if (m.metric.fieldType !== "log") throw new UserError("That metric isn't a running log");
  if (m.metric.archivedAt || m.section.archivedAt) throw new UserError("That metric is archived");
  const text = input.text.trim();
  const photos = input.photos ?? [];
  if (!text && photos.length === 0) throw new UserError("Write something or add a photo");
  if (text.length > 5000) throw new UserError("That line is too long");
  const { date } = resolveWhen(subject.timezone, now, { effectiveDate: input.effectiveDate });

  return db.transaction(async (tx) => {
    // The day's entry in this section: the latest one, or a new one.
    const [existing] = await tx
      .select()
      .from(entries)
      .where(and(eq(entries.sectionId, m.section.id), eq(entries.effectiveDate, date)))
      .orderBy(desc(entries.addedAt))
      .limit(1);
    const entry =
      existing ??
      (await tx.insert(entries).values({ sectionId: m.section.id, authorId: accountId, effectiveDate: date, addedAt: now, updatedAt: now }).returning())[0];

    const assetIds: string[] = [];
    for (const p of photos) {
      const [a] = await tx
        .insert(assets)
        .values({ entryId: entry.id, metricId, storageKey: p.key, contentType: p.contentType, bytes: p.bytes })
        .returning();
      assetIds.push(a.id);
    }
    const [cur] = await tx
      .select()
      .from(entryValues)
      .where(and(eq(entryValues.entryId, entry.id), eq(entryValues.metricId, metricId)));
    const line: LogLine = { id: crypto.randomUUID(), at: now.toISOString(), text, assetIds };
    const value: LogValue = { lines: [...((cur?.value as LogValue | undefined)?.lines ?? []), line] };
    if (value.lines.length > 500) throw new UserError("This log is full for the day");
    await tx
      .insert(entryValues)
      .values({ entryId: entry.id, metricId, value, valueNum: null })
      .onConflictDoUpdate({ target: [entryValues.entryId, entryValues.metricId], set: { value } });
    await tx.update(entries).set({ updatedAt: now }).where(eq(entries.id, entry.id));
    return { entryId: entry.id, line };
  });
}

/** Remove one line (a typo, a wrong photo). Its photos stay in storage but are no longer referenced. */
export async function removeLogLine(db: Db, accountId: string, entryId: string, metricId: string, lineId: string, now = new Date()) {
  await ownedEntry(db, accountId, entryId);
  const [cur] = await db.select().from(entryValues).where(and(eq(entryValues.entryId, entryId), eq(entryValues.metricId, metricId)));
  const lines = (cur?.value as LogValue | undefined)?.lines;
  if (!lines || !lines.some((l) => l.id === lineId)) throw notFound();
  const kept = lines.filter((l) => l.id !== lineId);
  await db.transaction(async (tx) => {
    const mine = and(eq(entryValues.entryId, entryId), eq(entryValues.metricId, metricId));
    if (kept.length) await tx.update(entryValues).set({ value: { lines: kept } }).where(mine);
    else await tx.delete(entryValues).where(mine);
    await tx.update(entries).set({ updatedAt: now }).where(eq(entries.id, entryId));
  });
}

export async function deleteEntry(db: Db, accountId: string, entryId: string) {
  await ownedEntry(db, accountId, entryId);
  await db.delete(entries).where(eq(entries.id, entryId));
}

// ---------- reading (always through the gate) ----------

export type FeedEntry = {
  id: string;
  sectionId: string;
  effectiveDate: string;
  effectiveTime?: string | null;
  addedAt?: Date;
  updatedAt?: Date;
  values: { metricId: string; value: unknown }[];
  comments: { id: string; authorName: string; body: string; createdAt: Date }[];
};

export async function getFeed(db: Db, jurnalId: string, viewer: Viewer, opts: { limit?: number; before?: string } = {}) {
  const loaded = await loadForViewer(db, jurnalId, viewer);
  const { access } = loaded;
  const visibleSectionIds = [...access.sectionIds];
  if (visibleSectionIds.length === 0) return { loaded, feed: [] as FeedEntry[] };

  const rows = await db
    .select()
    .from(entries)
    .where(
      and(
        inArray(entries.sectionId, visibleSectionIds),
        opts.before ? lte(entries.effectiveDate, opts.before) : undefined,
      ),
    )
    .orderBy(desc(entries.effectiveDate), desc(entries.addedAt))
    .limit(opts.limit ?? 100);
  const shown = viewEntries(access, rows);
  const ids = shown.map((e) => e.id);
  const values = ids.length ? await db.select().from(entryValues).where(inArray(entryValues.entryId, ids)) : [];
  const commentRows =
    ids.length && access.commentPerm !== "none"
      ? await db
          .select({ c: comments, authorName: accounts.name })
          .from(comments)
          .innerJoin(accounts, eq(accounts.id, comments.authorId))
          .where(inArray(comments.entryId, ids))
          .orderBy(asc(comments.createdAt))
      : [];

  const typeOf = new Map(loaded.allMetrics.map((m) => [m.id, m.fieldType]));
  const feed = shown.map<FeedEntry>((e) => ({
    ...e,
    values: values
      .filter((v) => v.entryId === e.id && access.metricIds.has(v.metricId))
      .map((v) => ({ metricId: v.metricId, value: viewValue(access, typeOf.get(v.metricId) ?? "", v.value) })),
    comments: commentRows
      .filter((r) => r.c.entryId === e.id)
      .map((r) => ({ id: r.c.id, authorName: r.authorName, body: r.c.body, createdAt: r.c.createdAt })),
  }));
  return { loaded, feed };
}

/** One metric's numeric history, for trend charts. Only if the viewer may see the metric. */
export async function getMetricSeries(db: Db, jurnalId: string, metricId: string, viewer: Viewer) {
  const loaded = await loadForViewer(db, jurnalId, viewer);
  const metric = loaded.allMetrics.find((m) => m.id === metricId);
  if (!metric || !loaded.access.metricIds.has(metricId)) throw notFound();
  const rows = await db
    .select({ date: entries.effectiveDate, num: entryValues.valueNum })
    .from(entryValues)
    .innerJoin(entries, eq(entries.id, entryValues.entryId))
    .where(and(eq(entryValues.metricId, metricId), sql`${entryValues.valueNum} is not null`))
    .orderBy(asc(entries.effectiveDate), asc(entries.addedAt));
  return { metric, points: rows.map((r) => ({ date: r.date, value: r.num as number })) };
}

export async function exportJurnal(db: Db, jurnalId: string, viewer: Viewer) {
  const { loaded, feed } = await getFeed(db, jurnalId, viewer, { limit: 100000 });
  const sectionName = new Map(loaded.allSections.map((s) => [s.id, s.name]));
  const metricById = new Map(loaded.allMetrics.map((m) => [m.id, m]));
  const rows = feed.flatMap((e) =>
    e.values.map((v) => ({
      date: e.effectiveDate,
      time: e.effectiveTime ?? "",
      section: sectionName.get(e.sectionId) ?? "",
      metric: metricById.get(v.metricId)?.name ?? "",
      value: v.value,
    })),
  );
  return { jurnal: loaded.jurnal.name, rows };
}

export function toCsv(rows: { date: string; time: string; section: string; metric: string; value: unknown }[]) {
  const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = rows.map((r) =>
    [r.date, r.time, r.section, r.metric, typeof r.value === "string" ? r.value : JSON.stringify(r.value)].map(esc).join(","),
  );
  return ["date,time,section,metric,value", ...lines].join("\n") + "\n";
}

/**
 * Delete an account and everything it owns. The database rows go first, in one transaction; the photo files
 * follow, best effort, so a storage hiccup can't leave a half-deleted account behind.
 */
export async function deleteAccount(db: Db, files: { delete(key: string): Promise<void> }, accountId: string) {
  const keys = await db.transaction(async (tx) => {
    const found = await tx
      .select({ key: assets.storageKey })
      .from(assets)
      .innerJoin(entries, eq(entries.id, assets.entryId))
      .innerJoin(sections, eq(sections.id, entries.sectionId))
      .innerJoin(jurnals, eq(jurnals.id, sections.jurnalId))
      .innerJoin(owners, eq(owners.id, jurnals.ownerId))
      .where(sql`${owners.accountId} = ${accountId} or ${entries.authorId} = ${accountId}`);
    // Entries written into other people's jurnals have no cascade from the account; remove them first.
    await tx.delete(entries).where(eq(entries.authorId, accountId));
    await tx.delete(accounts).where(eq(accounts.id, accountId));
    return found.map((r) => r.key);
  });
  await Promise.allSettled(keys.map((k) => files.delete(k)));
}

export async function photoAccess(db: Db, assetId: string, viewer: Viewer) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));
  if (!asset) throw notFound();
  const [row] = await db
    .select({ jurnalId: sections.jurnalId })
    .from(metrics)
    .innerJoin(sections, eq(sections.id, metrics.sectionId))
    .where(eq(metrics.id, asset.metricId));
  const loaded = await loadForViewer(db, row.jurnalId, viewer);
  if (!loaded.access.metricIds.has(asset.metricId)) throw notFound();
  return asset;
}
