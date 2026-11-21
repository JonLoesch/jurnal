"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { getDb } from "@/db/client";
import { accounts, entries, entryValues, metrics, sections, assets, type CommentPerm, type FieldType, type Precision } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseSchedule, parseValues } from "@/lib/formvalues";
import { UserError } from "@/server/errors";
import { requireAccountId } from "@/server/session";
import * as j from "@/server/journal";
import * as sh from "@/server/sharing";
import * as al from "@/server/alerts";
import * as tk from "@/server/tokens";
import type { TokenScope } from "@/db/schema";
import { MAX_PHOTO_BYTES, PHOTO_TYPES, storage } from "@/server/storage";
import { randomUUID } from "node:crypto";

const db = () => getDb();
const str = (f: FormData, k: string) => (f.get(k) === null ? null : String(f.get(k)));
const need = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!v) throw new UserError("Something was missing from that form");
  return v;
};

function withParam(url: string, key: string, value: string) {
  const u = new URL(url, "http://x");
  u.searchParams.set(key, value);
  return u.pathname + u.search;
}

/** Run an action; user mistakes come back to the page as a message, other errors surface. */
async function run(back: string, fn: () => Promise<string | void>): Promise<never> {
  let dest = back;
  try {
    const r = await fn();
    if (r) dest = r;
  } catch (e) {
    if (e instanceof UserError) dest = withParam(back, "error", e.message);
    else throw e;
  }
  revalidatePath("/", "layout");
  redirect(dest);
}

// ---------- sign in / out ----------

export async function devSignInAction(f: FormData) {
  await signIn("credentials", { email: str(f, "email"), name: str(f, "name"), redirectTo: "/" });
}
export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/" });
}
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

// ---------- account ----------

export async function updateAccountAction(f: FormData) {
  const id = await requireAccountId();
  await run("/settings", async () => {
    await j.updateAccountSettings(db(), id, {
      name: need(f, "name"),
      timezone: need(f, "timezone"),
      weekStart: Number(need(f, "weekStart")),
    });
  });
}

export type TokenFormState = { token?: string; error?: string };

/** Used with useActionState, so the plain token can be shown once without ever going in a URL. */
export async function createTokenAction(_prev: TokenFormState, f: FormData): Promise<TokenFormState> {
  const id = await requireAccountId();
  try {
    const { token } = await tk.createToken(db(), id, {
      name: str(f, "name") ?? "",
      scopes: f.getAll("scopes").map(String) as TokenScope[],
      days: Number(str(f, "days") || tk.DEFAULT_TOKEN_DAYS),
    });
    revalidatePath("/settings");
    return { token };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}

export async function revokeTokenAction(f: FormData) {
  const id = await requireAccountId();
  await run("/settings", () => tk.revokeToken(db(), id, need(f, "tokenId")));
}

export async function deleteAccountAction(f: FormData) {
  const id = await requireAccountId();
  await run("/settings", async () => {
    const [me] = await db().select().from(accounts).where(eq(accounts.id, id));
    if (!me || str(f, "confirm")?.toLowerCase() !== me.email.toLowerCase()) throw new UserError("Type your email address to confirm");
    await j.deleteAccount(db(), storage, id);
  });
  await signOut({ redirectTo: "/login" });
}

// ---------- jurnals ----------

export async function createJurnalAction(f: FormData) {
  const id = await requireAccountId();
  await run("/", async () => `/j/${(await j.createJurnal(db(), id, str(f, "name") ?? "")).id}`);
}

export async function updateJurnalAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}/settings`, () =>
    j.updateJurnal(db(), id, jid, {
      name: str(f, "name") ?? undefined,
      defaultPrecision: (str(f, "precision") as Precision | null) ?? undefined,
    }),
  );
}

export async function archiveJurnalAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}/settings`, async () => {
    await j.updateJurnal(db(), id, jid, { archived: true });
    return "/";
  });
}

export async function addSectionAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}/settings`, async () => void (await j.addSection(db(), id, jid, str(f, "name") ?? "")));
}

export async function updateSectionAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  const sid = need(f, "sectionId");
  await run(`/j/${jid}/settings`, async () => {
    const schedule = parseSchedule(str(f, "preset"), str(f, "times"));
    if (schedule === "invalid") throw new UserError("That schedule isn't valid");
    await j.updateSection(db(), id, sid, {
      name: str(f, "name") ?? undefined,
      protected: f.has("protectedPresent") ? f.get("protected") === "on" : undefined,
      schedule,
    });
  });
}

export async function archiveSectionAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}/settings`, () => j.updateSection(db(), id, need(f, "sectionId"), { archived: f.get("archived") === "yes" }));
}

export async function addMetricAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}/settings`, async () => {
    const type = need(f, "fieldType") as FieldType;
    const config: Record<string, unknown> = {};
    if (type === "choice") config.choices = (str(f, "choices") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (type === "number" && str(f, "unit")) config.unit = str(f, "unit");
    if (type === "sets") {
      if (str(f, "targetSets")) config.targetSets = Number(str(f, "targetSets"));
      if (str(f, "targetReps")) config.targetReps = Number(str(f, "targetReps"));
      config.unit = str(f, "unit") || "lb";
    }
    await j.addMetric(db(), id, need(f, "sectionId"), {
      name: str(f, "name") ?? "",
      fieldType: type,
      config,
      protected: f.get("protected") === "on",
    });
  });
}

export async function updateMetricAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}/settings`, () =>
    j.updateMetric(db(), id, need(f, "metricId"), {
      protected: f.has("protectedPresent") ? f.get("protected") === "on" : undefined,
      archived: f.has("archived") ? f.get("archived") === "yes" : undefined,
      fieldType: f.get("toNotes") === "yes" ? "richtext" : undefined,
    }),
  );
}

// ---------- entries ----------

async function attachPhotos(entryId: string, f: FormData) {
  const entryMetrics = await db()
    .select({ m: metrics })
    .from(entries)
    .innerJoin(sections, eq(sections.id, entries.sectionId))
    .innerJoin(metrics, eq(metrics.sectionId, sections.id))
    .where(eq(entries.id, entryId));
  for (const { m } of entryMetrics) {
    if (m.fieldType !== "richtext") continue;
    const files = f.getAll(`m_${m.id}_photos`).filter((x): x is File => x instanceof File && x.size > 0);
    if (!files.length) continue;
    const ids: string[] = [];
    for (const file of files.slice(0, 10)) {
      if (!PHOTO_TYPES.includes(file.type)) throw new UserError("Photos must be JPEG, PNG, WebP or GIF");
      if (file.size > MAX_PHOTO_BYTES) throw new UserError("Photos can be up to 8 MB");
      const key = randomUUID();
      await storage.put(key, new Uint8Array(await file.arrayBuffer()));
      const [a] = await db()
        .insert(assets)
        .values({ entryId, metricId: m.id, storageKey: key, contentType: file.type, bytes: file.size })
        .returning();
      ids.push(a.id);
    }
    // Add to (or create) the rich-text value so the photos inherit this metric's access.
    const rows = await db().select().from(entryValues).where(eq(entryValues.entryId, entryId));
    const cur = rows.find((r) => r.metricId === m.id)?.value as { text?: string; assetIds?: string[] } | undefined;
    const value = { text: cur?.text ?? "", assetIds: [...(cur?.assetIds ?? []), ...ids] };
    await db()
      .insert(entryValues)
      .values({ entryId, metricId: m.id, value, valueNum: null })
      .onConflictDoUpdate({ target: [entryValues.entryId, entryValues.metricId], set: { value } });
  }
}

export async function createEntryAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  const sid = need(f, "sectionId");
  await run(`/j/${jid}`, async () => {
    const sectionMetrics = await db().select().from(metrics).where(eq(metrics.sectionId, sid));
    const values = parseValues(sectionMetrics, (n) => (f.has(n) ? String(f.get(n)) : null));
    const hasPhotos = sectionMetrics.some((m) => f.getAll(`m_${m.id}_photos`).some((x) => x instanceof File && x.size > 0));
    if (hasPhotos) {
      // A photo alone is an answer: make sure rich-text fields with photos but no text still count.
      for (const m of sectionMetrics)
        if (m.fieldType === "richtext" && !(m.id in values) && f.getAll(`m_${m.id}_photos`).some((x) => x instanceof File && x.size > 0))
          values[m.id] = { text: "", assetIds: [] };
    }
    const entry = await j.createEntry(db(), id, sid, {
      effectiveDate: str(f, "date") || undefined,
      values,
    });
    await attachPhotos(entry.id, f);
  });
}

export async function appendLogLineAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}`, async () => {
    const files = f.getAll("photos").filter((x): x is File => x instanceof File && x.size > 0).slice(0, 10);
    const photos: { key: string; contentType: string; bytes: number }[] = [];
    for (const file of files) {
      if (!PHOTO_TYPES.includes(file.type)) throw new UserError("Photos must be JPEG, PNG, WebP or GIF");
      if (file.size > MAX_PHOTO_BYTES) throw new UserError("Photos can be up to 8 MB");
      const key = randomUUID();
      await storage.put(key, new Uint8Array(await file.arrayBuffer()));
      photos.push({ key, contentType: file.type, bytes: file.size });
    }
    await j.appendLogLine(db(), id, need(f, "metricId"), {
      text: str(f, "text") ?? "",
      photos,
      effectiveDate: str(f, "date") || undefined,
    });
  });
}

export async function removeLogLineAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}`, () => j.removeLogLine(db(), id, need(f, "entryId"), need(f, "metricId"), need(f, "lineId")));
}

export async function updateEntryAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  const eid = need(f, "entryId");
  await run(`/j/${jid}`, async () => {
    const [row] = await db().select().from(entries).where(eq(entries.id, eid));
    if (!row) throw new UserError("Entry not found");
    const sectionMetrics = await db().select().from(metrics).where(eq(metrics.sectionId, row.sectionId));
    const values = parseValues(sectionMetrics, (n) => (f.has(n) ? String(f.get(n)) : null));
    // Keep existing photos on rich-text fields when editing their text.
    const existing = await db().select().from(entryValues).where(eq(entryValues.entryId, eid));
    for (const m of sectionMetrics) {
      const cur = existing.find((e) => e.metricId === m.id)?.value as { assetIds?: string[] } | undefined;
      if (m.fieldType === "richtext" && cur?.assetIds?.length) {
        const v = (values[m.id] as { text: string; assetIds: string[] } | undefined) ?? { text: "", assetIds: [] };
        values[m.id] = { text: v.text, assetIds: cur.assetIds };
      }
    }
    await j.updateEntry(db(), id, eid, { effectiveDate: str(f, "date") || undefined, values });
    await attachPhotos(eid, f);
  });
}

export async function deleteEntryAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}`, () => j.deleteEntry(db(), id, need(f, "entryId")));
}

// ---------- sharing ----------

export async function createInviteAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}/sharing`, async () => {
    const token = await sh.createInvite(db(), id, jid, {
      commentPerm: (str(f, "commentPerm") as CommentPerm) || "none",
      canAlert: f.get("canAlert") === "on",
      precision: (str(f, "precision") as Precision) || null,
      expiresInDays: Number(str(f, "days") || 7),
      maxUses: Number(str(f, "maxUses") || 1),
    });
    return withParam(`/j/${jid}/sharing`, "invite", token);
  });
}

export async function revokeInviteAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}/sharing`, () => sh.revokeInvite(db(), id, need(f, "inviteId")));
}

export async function setPublicLinkAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}/sharing`, async () => void (await sh.setPublicLink(db(), id, jid, f.get("enabled") === "yes")));
}

export async function updateGrantAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}/sharing`, () =>
    sh.updateGrantOptions(db(), id, need(f, "grantId"), {
      commentPerm: (str(f, "commentPerm") as CommentPerm) || "none",
      canAlert: f.get("canAlert") === "on",
      precision: (str(f, "precision") as Precision) || null,
    }),
  );
}

export async function revokeGrantAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}/sharing`, () => sh.revokeGrant(db(), id, need(f, "grantId")));
}

export async function grantProtectedAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}/sharing`, () => {
    const [scope, scopeId] = need(f, "target").split(":");
    return sh.grantProtected(db(), id, jid, { scope: scope as "section" | "metric", scopeId, granteeId: need(f, "granteeId") });
  });
}

export async function leaveJurnalAction(f: FormData) {
  const id = await requireAccountId();
  await run("/", async () => {
    await sh.leaveJurnal(db(), id, need(f, "jurnalId"));
  });
}

export async function addCommentAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}`, async () => void (await sh.addComment(db(), id, need(f, "entryId"), str(f, "body") ?? "")));
}

export async function deleteCommentAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}`, () => sh.deleteComment(db(), id, need(f, "commentId")));
}

export async function redeemInviteAction(f: FormData) {
  const id = await requireAccountId();
  await run("/", async () => `/j/${await sh.redeemInvite(db(), id, need(f, "token"))}`);
}

// ---------- reminders ----------

export async function createSelfRuleAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}/settings`, async () => {
    await al.createSelfRule(db(), id, { jurnalId: jid, sectionId: str(f, "sectionId") || null, deadline: need(f, "deadline"), forDay: str(f, "forDay") === "previous" ? "previous" : undefined });
  });
}

export async function createAbsenceRuleAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}`, async () => {
    await al.createAbsenceRule(db(), id, {
      jurnalId: jid,
      sectionId: str(f, "sectionId") || null,
      days: Number(need(f, "days")),
      notifyAt: str(f, "notifyAt") || undefined,
    });
  });
}

export async function createDigestRuleAction(f: FormData) {
  const id = await requireAccountId();
  const jid = need(f, "jurnalId");
  await run(`/j/${jid}`, async () => {
    await al.createDigestRule(db(), id, { jurnalId: jid, notifyAt: str(f, "notifyAt") || undefined });
  });
}

export async function deleteRuleAction(f: FormData) {
  const id = await requireAccountId();
  await run(str(f, "back") || "/settings", () => al.deleteRule(db(), id, need(f, "ruleId")));
}

export async function snoozeAction(f: FormData) {
  const id = await requireAccountId();
  const hours = Number(str(f, "hours") || 1);
  await run(str(f, "back") || "/", () => al.snoozeFiring(db(), id, need(f, "firingId"), new Date(Date.now() + hours * 3_600_000)));
}

export async function dismissAction(f: FormData) {
  const id = await requireAccountId();
  await run(str(f, "back") || "/", () => al.dismissFiring(db(), id, need(f, "firingId")));
}
