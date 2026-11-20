import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb } from "@/db/client";
import type { FieldType, Schedule, TokenScope } from "@/db/schema";
import { FIELD_TYPES } from "@/lib/fieldtypes";
import { timeIn } from "@/lib/time";
import { UserError } from "./errors";
import { storage } from "./storage";
import { loadForViewer } from "./gate";
import * as j from "./journal";
import { grants, jurnals } from "@/db/schema";
import { eq } from "drizzle-orm";

type Extra = { authInfo?: { scopes: string[]; extra?: Record<string, unknown> } };
type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
type Result = { content: Content[]; isError?: boolean };

/** A tool that answers with something other than JSON text (an image). */
class Raw {
  constructor(public content: Content[]) {}
}

const ok = (data: unknown): Result => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const fail = (message: string): Result => ({ content: [{ type: "text", text: message }], isError: true });

/**
 * Run a tool as the token's owner, if the token carries the scope. Every tool goes through the same checks the
 * web app uses (ownership, grants, protected items, precision), so a token never sees more than its owner does.
 */
async function run<A>(scope: TokenScope, extra: Extra, args: A, fn: (accountId: string, args: A) => Promise<unknown>): Promise<Result> {
  const accountId = extra.authInfo?.extra?.accountId;
  if (typeof accountId !== "string") return fail("Not signed in");
  if (!extra.authInfo?.scopes.includes(scope)) return fail(`This token doesn't have the "${scope}" permission`);
  try {
    const out = await fn(accountId, args);
    return out instanceof Raw ? { content: out.content } : ok(out);
  } catch (e) {
    if (e instanceof UserError) return fail(e.message);
    console.error("mcp tool failed", e);
    return fail("Something went wrong");
  }
}

const tool =
  <A,>(scope: TokenScope, fn: (accountId: string, args: A) => Promise<unknown>) =>
  (args: A, extra: Extra) =>
    run(scope, extra, args, fn);

const jurnalId = z.string().uuid().describe("A jurnal's id, from list_jurnals");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("A calendar date, YYYY-MM-DD, in the jurnal owner's timezone");
const FIELD_TYPE_VALUES = FIELD_TYPES.map((f) => f.type) as [FieldType, ...FieldType[]];
const scheduleSchema = z
  .object({
    count: z.number().int().min(1),
    period: z.enum(["day", "week"]),
    weekdays: z.array(z.number().int().min(1).max(7)).optional(),
    times: z.array(z.string()).optional(),
  })
  .describe("How often it is expected: e.g. {count:1,period:'day'} daily, {count:1,period:'week'} once a week");

export function registerTools(server: McpServer) {
  // ---------- read ----------

  server.registerTool(
    "list_jurnals",
    { description: "List the jurnals you own and the ones shared with you." },
    (extra: Extra) => run("read", extra, undefined, async (accountId) => {
      const db = getDb();
      const mine = await j.listMyJurnals(db, accountId);
      const shared = await db
        .select({ id: jurnals.id, name: jurnals.name })
        .from(grants)
        .innerJoin(jurnals, eq(jurnals.id, grants.jurnalId))
        .where(eq(grants.granteeId, accountId));
      return {
        owned: mine.map((x) => ({ id: x.id, name: x.name })),
        sharedWithMe: shared.filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i),
      };
    }),
  );

  server.registerTool(
    "get_jurnal",
    { description: "A jurnal's structure: its sections and metrics (with ids, field types and settings), limited to what you may see.", inputSchema: { jurnalId } },
    tool<{ jurnalId: string }>("read", async (accountId, a) => {
      const { jurnal, allSections, allMetrics, access, subject } = await loadForViewer(getDb(), a.jurnalId, { accountId });
      return {
        id: jurnal.id,
        name: jurnal.name,
        timezone: subject.timezone,
        yourRole: access.role,
        sections: allSections
          .filter((s) => access.sectionIds.has(s.id))
          .map((s) => ({
            id: s.id,
            name: s.isDefault ? null : s.name,
            retired: !!s.archivedAt,
            schedule: s.schedule,
            metrics: allMetrics
              .filter((m) => m.sectionId === s.id && access.metricIds.has(m.id))
              .map((m) => ({ id: m.id, name: m.name, type: m.fieldType, config: m.config, retired: !!m.archivedAt })),
          })),
      };
    }),
  );

  server.registerTool(
    "get_entries",
    {
      description:
        "Entries in a jurnal, newest first, with each metric's value by name. Running logs list their lines with the time each was written. Photos appear as photoIds: fetch one with get_photo. Dates are calendar dates in the owner's timezone.",
      inputSchema: { jurnalId, from: date.optional(), to: date.optional(), limit: z.number().int().min(1).max(500).optional() },
    },
    tool<{ jurnalId: string; from?: string; to?: string; limit?: number }>("read", async (accountId, a) => {
      const { loaded, feed } = await j.getFeed(getDb(), a.jurnalId, { accountId }, { limit: 2000, before: a.to });
      const tz = loaded.subject.timezone;
      const sectionName = new Map(loaded.allSections.map((s) => [s.id, s.isDefault ? null : s.name]));
      const metricById = new Map(loaded.allMetrics.map((m) => [m.id, m]));
      return feed
        .filter((e) => !a.from || e.effectiveDate >= a.from)
        .slice(0, a.limit ?? 100)
        .map((e) => ({
          id: e.id,
          date: e.effectiveDate,
          time: e.effectiveTime ?? undefined,
          section: sectionName.get(e.sectionId),
          values: Object.fromEntries(
            e.values.map((v) => {
              const m = metricById.get(v.metricId);
              if (m?.fieldType === "log") {
                const lines = (v.value as { lines: { at?: string; text: string; assetIds?: string[] }[] }).lines;
                return [m.name, lines.map((l) => ({ time: l.at ? timeIn(tz, new Date(l.at)) : undefined, text: l.text, photoIds: l.assetIds ?? [] }))];
              }
              if (m?.fieldType === "richtext") {
                const r = v.value as { text: string; assetIds?: string[] };
                return [m.name, { text: r.text, photoIds: r.assetIds ?? [] }];
              }
              return [m?.name ?? v.metricId, v.value];
            }),
          ),
          comments: e.comments.map((c) => ({ by: c.authorName, text: c.body })),
        }));
    }),
  );

  server.registerTool(
    "get_metric_series",
    { description: "A numeric metric's history as date/value points, for trends.", inputSchema: { jurnalId, metricId: z.string().uuid() } },
    tool<{ jurnalId: string; metricId: string }>("read", async (accountId, a) => {
      const { metric, points } = await j.getMetricSeries(getDb(), a.jurnalId, a.metricId, { accountId });
      return { metric: metric.name, type: metric.fieldType, points };
    }),
  );

  server.registerTool(
    "get_photo",
    {
      description: "A photo attached to an entry, as an image. Use a photoId from get_entries. Only photos you may see are returned.",
      inputSchema: { photoId: z.string().uuid() },
    },
    tool<{ photoId: string }>("read", async (accountId, a) => {
      const asset = await j.photoAccess(getDb(), a.photoId, { accountId });
      if (asset.bytes > 8 * 1024 * 1024) throw new UserError("That photo is too large to send");
      const bytes = await storage.get(asset.storageKey);
      return new Raw([{ type: "image", data: Buffer.from(bytes).toString("base64"), mimeType: asset.contentType }]);
    }),
  );

  // ---------- entries ----------

  server.registerTool(
    "create_entry",
    {
      description:
        "Add an entry to a section of a jurnal you own. `values` maps metric ids to values: text as a string, number/duration(minutes)/stars as numbers, yesno as true/false, choice as one of its options, timeofday as 'HH:MM', sets as [{reps,weight}], richtext as {text}. Use append_log_line for running logs. The date defaults to today and can't be in the future.",
      inputSchema: { sectionId: z.string().uuid(), values: z.record(z.string(), z.unknown()), date: date.optional(), time: z.string().optional() },
    },
    tool<{ sectionId: string; values: Record<string, unknown>; date?: string; time?: string }>("entries", async (accountId, a) => {
      const e = await j.createEntry(getDb(), accountId, a.sectionId, { values: a.values, effectiveDate: a.date, effectiveTime: a.time });
      return { entryId: e.id, date: e.effectiveDate };
    }),
  );

  server.registerTool(
    "update_entry",
    {
      description: "Replace the values of an entry you own (fields you leave out are cleared, except running logs, which are kept). Can also change its date.",
      inputSchema: { entryId: z.string().uuid(), values: z.record(z.string(), z.unknown()), date: date.optional(), time: z.string().optional() },
    },
    tool<{ entryId: string; values: Record<string, unknown>; date?: string; time?: string }>("entries", async (accountId, a) => {
      await j.updateEntry(getDb(), accountId, a.entryId, { values: a.values, effectiveDate: a.date, effectiveTime: a.time });
      return { updated: a.entryId };
    }),
  );

  server.registerTool(
    "append_log_line",
    {
      description: "Add a timestamped line to a running-log metric, on that day's entry (created if needed). The date defaults to today.",
      inputSchema: { metricId: z.string().uuid(), text: z.string().min(1).max(5000), date: date.optional() },
    },
    tool<{ metricId: string; text: string; date?: string }>("entries", async (accountId, a) => {
      const r = await j.appendLogLine(getDb(), accountId, a.metricId, { text: a.text, effectiveDate: a.date });
      return { entryId: r.entryId, lineId: r.line.id, at: r.line.at };
    }),
  );

  // ---------- settings ----------

  server.registerTool(
    "create_jurnal",
    { description: "Create a new jurnal.", inputSchema: { name: z.string().min(1).max(100) } },
    tool<{ name: string }>("settings", async (accountId, a) => {
      const x = await j.createJurnal(getDb(), accountId, a.name);
      return { id: x.id, name: x.name };
    }),
  );

  server.registerTool(
    "add_section",
    { description: "Add a section to a jurnal you own.", inputSchema: { jurnalId, name: z.string().min(1).max(100), schedule: scheduleSchema.optional() } },
    tool<{ jurnalId: string; name: string; schedule?: Schedule }>("settings", async (accountId, a) => {
      const s = await j.addSection(getDb(), accountId, a.jurnalId, a.name);
      if (a.schedule) await j.updateSection(getDb(), accountId, s.id, { schedule: a.schedule });
      return { id: s.id, name: s.name };
    }),
  );

  server.registerTool(
    "update_section",
    {
      description: "Rename, reschedule, protect or retire a section you own. Retiring keeps its data.",
      inputSchema: { sectionId: z.string().uuid(), name: z.string().min(1).max(100).optional(), schedule: scheduleSchema.nullable().optional(), protected: z.boolean().optional(), archived: z.boolean().optional() },
    },
    tool<{ sectionId: string; name?: string; schedule?: Schedule | null; protected?: boolean; archived?: boolean }>("settings", async (accountId, a) => {
      const { sectionId, ...patch } = a;
      await j.updateSection(getDb(), accountId, sectionId, patch);
      return { updated: sectionId };
    }),
  );

  server.registerTool(
    "add_metric",
    {
      description: `Add a metric to a section you own. Field types: ${FIELD_TYPES.map((f) => f.type).join(", ")}. config: choice needs {choices:[...]}; number takes {unit,min,max}; sets takes {unit,targetSets,targetReps}.`,
      inputSchema: { sectionId: z.string().uuid(), name: z.string().min(1).max(100), fieldType: z.enum(FIELD_TYPE_VALUES), config: z.record(z.string(), z.unknown()).optional(), protected: z.boolean().optional() },
    },
    tool<{ sectionId: string; name: string; fieldType: FieldType; config?: Record<string, unknown>; protected?: boolean }>("settings", async (accountId, a) => {
      const { sectionId, ...input } = a;
      const m = await j.addMetric(getDb(), accountId, sectionId, input);
      return { id: m.id, name: m.name };
    }),
  );

  server.registerTool(
    "update_metric",
    {
      description: "Rename, protect or retire a metric you own. Retiring keeps its data.",
      inputSchema: { metricId: z.string().uuid(), name: z.string().min(1).max(100).optional(), protected: z.boolean().optional(), archived: z.boolean().optional() },
    },
    tool<{ metricId: string; name?: string; protected?: boolean; archived?: boolean }>("settings", async (accountId, a) => {
      const { metricId, ...patch } = a;
      await j.updateMetric(getDb(), accountId, metricId, patch);
      return { updated: metricId };
    }),
  );
}
