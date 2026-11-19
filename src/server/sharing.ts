import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  accounts,
  comments,
  entries,
  grants,
  invites,
  jurnals,
  owners,
  reminderRules,
  sections,
  type CommentPerm,
  type Precision,
} from "@/db/schema";
import { UserError, forbidden, notFound } from "./errors";
import { loadForViewer, requireOwner } from "./gate";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const newToken = () => randomBytes(24).toString("base64url");

export type GrantOptions = { commentPerm?: CommentPerm; canAlert?: boolean; precision?: Precision | null };

// ---------- invites ----------

export async function createInvite(
  db: Db,
  accountId: string,
  jurnalId: string,
  opts: GrantOptions & { expiresInDays?: number; maxUses?: number } = {},
  now = new Date(),
) {
  await requireOwner(db, accountId, jurnalId);
  const days = opts.expiresInDays ?? 7;
  const maxUses = opts.maxUses ?? 1;
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new UserError("Expiry must be 1 to 365 days");
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000) throw new UserError("Uses must be 1 to 1000");
  const token = newToken();
  await db.insert(invites).values({
    jurnalId,
    tokenHash: sha256(token),
    commentPerm: opts.commentPerm ?? "none",
    canAlert: opts.canAlert ?? false,
    precision: opts.precision ?? null,
    expiresAt: new Date(now.getTime() + days * 86_400_000),
    maxUses,
  });
  return token; // shown once; only its hash is stored
}

export async function describeInvite(db: Db, token: string, now = new Date()) {
  const [row] = await db
    .select({ invite: invites, jurnalName: jurnals.name })
    .from(invites)
    .innerJoin(jurnals, eq(jurnals.id, invites.jurnalId))
    .where(eq(invites.tokenHash, sha256(token)));
  if (!row) return null;
  const { invite } = row;
  const usable = !invite.revokedAt && invite.expiresAt > now && invite.uses < invite.maxUses;
  return { jurnalName: row.jurnalName, jurnalId: invite.jurnalId, usable };
}

export async function redeemInvite(db: Db, accountId: string, token: string, now = new Date()) {
  const [invite] = await db.select().from(invites).where(eq(invites.tokenHash, sha256(token)));
  if (!invite || invite.revokedAt || invite.expiresAt <= now || invite.uses >= invite.maxUses)
    throw new UserError("This invite is no longer valid", 404);
  const [{ ownerAccountId }] = await db
    .select({ ownerAccountId: owners.accountId })
    .from(jurnals)
    .innerJoin(owners, eq(owners.id, jurnals.ownerId))
    .where(eq(jurnals.id, invite.jurnalId));
  if (ownerAccountId === accountId) throw new UserError("This is your own jurnal");

  return db.transaction(async (tx) => {
    // Count the use atomically so a single-use invite can't be redeemed twice.
    const claimed = await tx
      .update(invites)
      .set({ uses: invite.uses + 1 })
      .where(and(eq(invites.id, invite.id), eq(invites.uses, invite.uses)))
      .returning({ id: invites.id });
    if (claimed.length === 0) throw new UserError("This invite is no longer valid", 404);
    await tx
      .insert(grants)
      .values({
        jurnalId: invite.jurnalId,
        scope: "jurnal",
        scopeId: invite.jurnalId,
        granteeId: accountId,
        commentPerm: invite.commentPerm,
        canAlert: invite.canAlert,
        precision: invite.precision,
      })
      .onConflictDoNothing();
    return invite.jurnalId;
  });
}

export async function revokeInvite(db: Db, accountId: string, inviteId: string) {
  const [invite] = await db.select().from(invites).where(eq(invites.id, inviteId));
  if (!invite) throw notFound();
  await requireOwner(db, accountId, invite.jurnalId);
  await db.update(invites).set({ revokedAt: new Date() }).where(eq(invites.id, inviteId));
}

export async function listInvites(db: Db, accountId: string, jurnalId: string) {
  await requireOwner(db, accountId, jurnalId);
  return db.select().from(invites).where(eq(invites.jurnalId, jurnalId));
}

// ---------- grants ----------

export async function listGrants(db: Db, accountId: string, jurnalId: string) {
  await requireOwner(db, accountId, jurnalId);
  return db
    .select({ grant: grants, name: accounts.name, email: accounts.email })
    .from(grants)
    .innerJoin(accounts, eq(accounts.id, grants.granteeId))
    .where(eq(grants.jurnalId, jurnalId));
}

/** Change what an existing follower may do on the jurnal (comments, alerts, precision). */
export async function updateGrantOptions(db: Db, accountId: string, grantId: string, opts: GrantOptions) {
  const [g] = await db.select().from(grants).where(eq(grants.id, grantId));
  if (!g || g.scope !== "jurnal") throw notFound();
  await requireOwner(db, accountId, g.jurnalId);
  const set: Partial<typeof grants.$inferInsert> = {};
  if (opts.commentPerm !== undefined) set.commentPerm = opts.commentPerm;
  if (opts.canAlert !== undefined) set.canAlert = opts.canAlert;
  if (opts.precision !== undefined) set.precision = opts.precision;
  if (Object.keys(set).length) await db.update(grants).set(set).where(eq(grants.id, grantId));
  if (opts.canAlert === false) {
    // Their absence alerts stop with the permission.
    await db
      .delete(reminderRules)
      .where(and(eq(reminderRules.jurnalId, g.jurnalId), eq(reminderRules.ownerAccountId, g.granteeId), eq(reminderRules.kind, "follower_absence")));
  }
}

/**
 * Give a follower access to a protected section or metric. They must already follow the jurnal:
 * a section or metric grant on its own would show nothing, so we refuse it instead of letting it dangle.
 */
export async function grantProtected(
  db: Db,
  accountId: string,
  jurnalId: string,
  input: { scope: "section" | "metric"; scopeId: string; granteeId: string },
) {
  const { allSections, allMetrics } = await requireOwner(db, accountId, jurnalId);
  const valid =
    input.scope === "section"
      ? allSections.some((s) => s.id === input.scopeId)
      : allMetrics.some((m) => m.id === input.scopeId);
  if (!valid) throw notFound();
  const [base] = await db
    .select()
    .from(grants)
    .where(and(eq(grants.jurnalId, jurnalId), eq(grants.scope, "jurnal"), eq(grants.granteeId, input.granteeId)));
  if (!base) throw new UserError("Share the jurnal with them first; protected access builds on it");
  await db
    .insert(grants)
    .values({ jurnalId, scope: input.scope, scopeId: input.scopeId, granteeId: input.granteeId })
    .onConflictDoNothing();
}

export async function revokeGrant(db: Db, accountId: string, grantId: string) {
  const [g] = await db.select().from(grants).where(eq(grants.id, grantId));
  if (!g) throw notFound();
  await requireOwner(db, accountId, g.jurnalId);
  await removeGrant(db, g);
}

/** A follower stops following on their own. */
export async function leaveJurnal(db: Db, accountId: string, jurnalId: string) {
  const [g] = await db
    .select()
    .from(grants)
    .where(and(eq(grants.jurnalId, jurnalId), eq(grants.scope, "jurnal"), eq(grants.granteeId, accountId)));
  if (!g) throw notFound();
  await removeGrant(db, g);
}

async function removeGrant(db: Db, g: typeof grants.$inferSelect) {
  await db.transaction(async (tx) => {
    if (g.scope === "jurnal") {
      // Losing jurnal access removes everything built on it, including their alerts on it.
      await tx.delete(grants).where(and(eq(grants.jurnalId, g.jurnalId), eq(grants.granteeId, g.granteeId)));
      await tx
        .delete(reminderRules)
        .where(and(eq(reminderRules.jurnalId, g.jurnalId), eq(reminderRules.ownerAccountId, g.granteeId)));
    } else {
      await tx.delete(grants).where(eq(grants.id, g.id));
    }
  });
}

export async function setPublicLink(db: Db, accountId: string, jurnalId: string, enabled: boolean) {
  await requireOwner(db, accountId, jurnalId);
  const token = enabled ? newToken() : null;
  await db.update(jurnals).set({ linkToken: token }).where(eq(jurnals.id, jurnalId));
  return token;
}

/** What the sharing page should warn about. */
export async function sharingWarnings(db: Db, accountId: string, jurnalId: string) {
  const { allSections, allMetrics } = await requireOwner(db, accountId, jurnalId);
  const protectedSections = allSections.filter((s) => s.protected);
  const protectedMetrics = allMetrics.filter((m) => m.protected);
  return {
    hasProtectedItems: protectedSections.length + protectedMetrics.length > 0,
    protectedSections: protectedSections.map((s) => s.name),
    protectedMetrics: protectedMetrics.map((m) => m.name),
  };
}

// ---------- comments ----------

export async function addComment(db: Db, accountId: string, entryId: string, body: string) {
  const text = body.trim();
  if (!text) throw new UserError("Write something first");
  if (text.length > 2000) throw new UserError("That comment is too long");
  const [row] = await db
    .select({ entry: entries, jurnalId: sections.jurnalId })
    .from(entries)
    .innerJoin(sections, eq(sections.id, entries.sectionId))
    .where(eq(entries.id, entryId));
  if (!row) throw notFound();
  const { access } = await loadForViewer(db, row.jurnalId, { accountId });
  if (!access.sectionIds.has(row.entry.sectionId)) throw notFound();
  if (access.commentPerm !== "write") throw forbidden("You can't comment here");
  const [c] = await db.insert(comments).values({ entryId, authorId: accountId, body: text }).returning();
  return c;
}

export async function deleteComment(db: Db, accountId: string, commentId: string) {
  const [row] = await db
    .select({ comment: comments, jurnalId: sections.jurnalId })
    .from(comments)
    .innerJoin(entries, eq(entries.id, comments.entryId))
    .innerJoin(sections, eq(sections.id, entries.sectionId))
    .where(eq(comments.id, commentId));
  if (!row) throw notFound();
  const { access } = await loadForViewer(db, row.jurnalId, { accountId });
  if (row.comment.authorId !== accountId && access.role !== "owner") throw forbidden();
  await db.delete(comments).where(eq(comments.id, commentId));
}
