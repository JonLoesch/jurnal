import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  accounts,
  alertFirings,
  entries,
  jurnals,
  pushSubscriptions,
  reminderRules,
  type RuleConfig,
} from "@/db/schema";
import { evaluateRule, type RuleInput } from "@/lib/rules";
import { dateIn, isHHMM } from "@/lib/time";
import { UserError, notFound } from "./errors";
import { loadForViewer, requireOwner } from "./gate";
import type { Notifier } from "./notify";

type Rule = typeof reminderRules.$inferSelect;

// ---------- creating and listing rules ----------

export async function createSelfRule(
  db: Db,
  accountId: string,
  input: { jurnalId: string; sectionId?: string | null; deadline: string },
) {
  const { allSections } = await requireOwner(db, accountId, input.jurnalId);
  if (!isHHMM(input.deadline)) throw new UserError("Deadline should look like 10:00");
  if (input.sectionId && !allSections.some((s) => s.id === input.sectionId)) throw notFound();
  const [r] = await db
    .insert(reminderRules)
    .values({
      ownerAccountId: accountId,
      jurnalId: input.jurnalId,
      sectionId: input.sectionId ?? null,
      kind: "self",
      config: { type: "deadline", deadline: input.deadline },
    })
    .returning();
  return r;
}

/** A follower asks to be told when a jurnal goes quiet. Needs the owner's "may set alerts" permission. */
export async function createAbsenceRule(
  db: Db,
  accountId: string,
  input: { jurnalId: string; sectionId?: string | null; days: number; notifyAt?: string },
) {
  const { access } = await loadForViewer(db, input.jurnalId, { accountId });
  if (access.role !== "grantee" || !access.canAlert) throw new UserError("You haven't been given permission to set alerts here", 403);
  if (input.sectionId && !access.sectionIds.has(input.sectionId)) throw notFound();
  const notifyAt = input.notifyAt ?? "10:00";
  if (!isHHMM(notifyAt)) throw new UserError("Delivery time should look like 10:00");
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 365) throw new UserError("Days must be 1 to 365");
  const [r] = await db
    .insert(reminderRules)
    .values({
      ownerAccountId: accountId,
      jurnalId: input.jurnalId,
      sectionId: input.sectionId ?? null,
      kind: "follower_absence",
      config: { type: "absence", days: input.days, notifyAt },
    })
    .returning();
  return r;
}

/**
 * A follower asks for a daily summary of new entries. Any grantee may: it only reports what they can already
 * read, and day-level, so it needs no "may set alerts" permission. The owner has no use for one.
 */
export async function createDigestRule(
  db: Db,
  accountId: string,
  input: { jurnalId: string; sectionId?: string | null; notifyAt?: string },
) {
  const { access } = await loadForViewer(db, input.jurnalId, { accountId });
  if (access.role !== "grantee") throw new UserError("Only people this jurnal is shared with can ask for updates", 403);
  const sectionId = input.sectionId || null;
  if (sectionId && !access.sectionIds.has(sectionId)) throw notFound();
  const notifyAt = input.notifyAt ?? "10:00";
  if (!isHHMM(notifyAt)) throw new UserError("Delivery time should look like 10:00");
  const mine = await db
    .select({ sectionId: reminderRules.sectionId })
    .from(reminderRules)
    .where(and(eq(reminderRules.jurnalId, input.jurnalId), eq(reminderRules.ownerAccountId, accountId), eq(reminderRules.kind, "follower_digest")));
  if (mine.some((r) => r.sectionId === sectionId)) throw new UserError("You already get updates for this");
  const [r] = await db
    .insert(reminderRules)
    .values({
      ownerAccountId: accountId,
      jurnalId: input.jurnalId,
      sectionId,
      kind: "follower_digest",
      config: { type: "digest", notifyAt },
    })
    .returning();
  return r;
}

export async function deleteRule(db: Db, accountId: string, ruleId: string) {
  const deleted = await db
    .delete(reminderRules)
    .where(and(eq(reminderRules.id, ruleId), eq(reminderRules.ownerAccountId, accountId)))
    .returning({ id: reminderRules.id });
  if (deleted.length === 0) throw notFound();
}

export async function listMyRules(db: Db, accountId: string) {
  return db
    .select({ rule: reminderRules, jurnalName: jurnals.name })
    .from(reminderRules)
    .innerJoin(jurnals, eq(jurnals.id, reminderRules.jurnalId))
    .where(eq(reminderRules.ownerAccountId, accountId));
}

/** Transparency: who has set absence alerts or update digests on a jurnal I own. */
export async function listAlertsOnMyJurnal(db: Db, accountId: string, jurnalId: string) {
  await requireOwner(db, accountId, jurnalId);
  return db
    .select({ rule: reminderRules, followerName: accounts.name })
    .from(reminderRules)
    .innerJoin(accounts, eq(accounts.id, reminderRules.ownerAccountId))
    .where(and(eq(reminderRules.jurnalId, jurnalId), inArray(reminderRules.kind, ["follower_absence", "follower_digest"])));
}

// ---------- evaluation ----------

/** Build the evaluator's inputs for a rule, using only what the rule's owner may see. Null = dormant. */
async function inputFor(db: Db, rule: Rule, now: Date): Promise<(RuleInput & { jurnalName: string }) | null> {
  let loaded;
  try {
    loaded = await loadForViewer(db, rule.jurnalId, { accountId: rule.ownerAccountId });
  } catch {
    return null; // access was revoked
  }
  const { access, subject, jurnal } = loaded;
  if (rule.kind === "follower_absence" && !(access.role === "grantee" && access.canAlert)) return null;
  if (rule.kind === "follower_digest" && access.role !== "grantee") return null;
  if (rule.kind === "self" && access.role !== "owner") return null;
  if (jurnal.archivedAt) return null;

  const scopeSectionIds = rule.sectionId ? (access.sectionIds.has(rule.sectionId) ? [rule.sectionId] : []) : [...access.sectionIds];
  const rows = scopeSectionIds.length
    ? await db
        .select({ date: entries.effectiveDate, addedAt: entries.addedAt })
        .from(entries)
        .where(inArray(entries.sectionId, scopeSectionIds))
    : [];
  const section = rule.sectionId ? loaded.allSections.find((s) => s.id === rule.sectionId) : undefined;
  if (rule.sectionId && (!section || section.archivedAt)) return null;
  const [recipient] = await db.select().from(accounts).where(eq(accounts.id, rule.ownerAccountId));

  return {
    jurnalName: jurnal.name,
    kind: rule.kind,
    config: rule.config as RuleConfig,
    schedule: section?.schedule ?? null,
    now,
    subjectTz: subject.timezone,
    subjectWeekStart: subject.weekStart,
    recipientTz: recipient.timezone,
    entryDates: rows.map((r) => r.date),
    // A new digest reports only what is added after it was asked for, never the existing backlog.
    addedDates: rows.filter((r) => r.addedAt >= rule.createdAt).map((r) => dateIn(subject.timezone, r.addedAt)),
    baselineDate: dateIn(subject.timezone, jurnal.createdAt),
    label: section && !section.isDefault ? `${jurnal.name} / ${section.name}` : jurnal.name,
  };
}

export type TickResult = { evaluated: number; fired: number; resent: number };

/** One pass of the scheduler: fire what's due (once per streak or slot) and re-send expired snoozes. */
export async function runTick(db: Db, notifier: Notifier, now = new Date()): Promise<TickResult> {
  const rules = await db.select().from(reminderRules).where(eq(reminderRules.active, true));
  let fired = 0;
  for (const rule of rules) {
    const input = await inputFor(db, rule, now);
    if (!input) continue;
    const result = evaluateRule(input);
    if (!result.due) continue;
    const inserted = await db
      .insert(alertFirings)
      .values({
        ruleId: rule.id,
        dedupeKey: result.dedupeKey,
        firedAt: now,
        lastEffectiveDate: result.lastEffectiveDate,
        message: result.message,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) continue; // already fired for this streak or slot
    fired++;
    // A digest is news, not a nag: it opens the jurnal plainly and never becomes an overdue banner.
    await notifier.send(rule.ownerAccountId, {
      title: input.jurnalName,
      body: result.message,
      url: rule.kind === "follower_digest" ? `/j/${rule.jurnalId}` : `/j/${rule.jurnalId}?from=alert&firing=${inserted[0].id}`,
    });
  }

  let resent = 0;
  const snoozed = await db
    .select({ firing: alertFirings, rule: reminderRules })
    .from(alertFirings)
    .innerJoin(reminderRules, eq(reminderRules.id, alertFirings.ruleId))
    .where(and(lte(alertFirings.snoozedUntil, now), isNull(alertFirings.dismissedAt)));
  for (const { firing, rule } of snoozed) {
    if (rule.kind === "follower_digest") continue;
    await db.update(alertFirings).set({ snoozedUntil: null }).where(eq(alertFirings.id, firing.id));
    const input = await inputFor(db, rule, now);
    if (!input) continue;
    const result = evaluateRule(input);
    if (!result.due || result.dedupeKey !== firing.dedupeKey) continue; // resolved while snoozed
    resent++;
    await notifier.send(rule.ownerAccountId, {
      title: input.jurnalName,
      body: `Reminder: ${result.message}`,
      url: `/j/${rule.jurnalId}?from=alert&firing=${firing.id}`,
    });
  }
  return { evaluated: rules.length, fired, resent };
}

// ---------- what the viewer sees ----------

export type OverdueBanner = { firingId: string; jurnalId: string; jurnalName: string; message: string; firedAt: Date };

/** Alerts that have fired for this account, are not dismissed or snoozed, and are still true now. */
export async function getOverdue(db: Db, accountId: string, now = new Date()): Promise<OverdueBanner[]> {
  const rows = await db
    .select({ firing: alertFirings, rule: reminderRules })
    .from(alertFirings)
    .innerJoin(reminderRules, eq(reminderRules.id, alertFirings.ruleId))
    .where(
      and(
        eq(reminderRules.ownerAccountId, accountId),
        isNull(alertFirings.dismissedAt),
        or(isNull(alertFirings.snoozedUntil), lte(alertFirings.snoozedUntil, now)),
      ),
    );
  const banners: OverdueBanner[] = [];
  for (const { firing, rule } of rows) {
    if (rule.kind === "follower_digest") continue;
    const input = await inputFor(db, rule, now);
    if (!input) continue;
    const result = evaluateRule({ ...input, now });
    // Still overdue only if the same streak or slot is still unmet. Computed, not stored.
    if (!result.due || result.dedupeKey !== firing.dedupeKey) continue;
    banners.push({ firingId: firing.id, jurnalId: rule.jurnalId, jurnalName: input.jurnalName, message: firing.message, firedAt: firing.firedAt });
  }
  return banners;
}

/** For the `?from=alert` link: has something been logged since this alert fired? */
export async function alertLinkStatus(db: Db, accountId: string, firingId: string) {
  const [row] = await db
    .select({ firing: alertFirings, rule: reminderRules })
    .from(alertFirings)
    .innerJoin(reminderRules, eq(reminderRules.id, alertFirings.ruleId))
    .where(and(eq(alertFirings.id, firingId), eq(reminderRules.ownerAccountId, accountId)));
  if (!row) throw notFound();
  const { access } = await loadForViewer(db, row.rule.jurnalId, { accountId });
  const scope = row.rule.sectionId ? [row.rule.sectionId].filter((s) => access.sectionIds.has(s)) : [...access.sectionIds];
  const newer = scope.length
    ? await db
        .select({ id: entries.id })
        .from(entries)
        .where(and(inArray(entries.sectionId, scope), gt(entries.addedAt, row.firing.firedAt)))
        .limit(1)
    : [];
  return { newerEntryExists: newer.length > 0, message: row.firing.message };
}

async function ownFiring(db: Db, accountId: string, firingId: string) {
  const [row] = await db
    .select({ id: alertFirings.id })
    .from(alertFirings)
    .innerJoin(reminderRules, eq(reminderRules.id, alertFirings.ruleId))
    .where(and(eq(alertFirings.id, firingId), eq(reminderRules.ownerAccountId, accountId)));
  if (!row) throw notFound();
}

export async function snoozeFiring(db: Db, accountId: string, firingId: string, until: Date) {
  await ownFiring(db, accountId, firingId);
  await db.update(alertFirings).set({ snoozedUntil: until }).where(eq(alertFirings.id, firingId));
}

export async function dismissFiring(db: Db, accountId: string, firingId: string) {
  await ownFiring(db, accountId, firingId);
  await db.update(alertFirings).set({ dismissedAt: new Date() }).where(eq(alertFirings.id, firingId));
}

// ---------- push subscriptions ----------

export async function savePushSubscription(
  db: Db,
  accountId: string,
  sub: { endpoint: string; p256dh: string; auth: string },
) {
  if (!sub.endpoint.startsWith("https://")) throw new UserError("Invalid push subscription");
  await db
    .insert(pushSubscriptions)
    .values({ accountId, ...sub })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { accountId, p256dh: sub.p256dh, auth: sub.auth } });
}

