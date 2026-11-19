import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { accounts, grants, jurnals, metrics, owners, sections } from "@/db/schema";
import { computeAccess, type Access } from "@/lib/access";
import { notFound } from "./errors";

export type Viewer = { accountId: string | null; linkToken?: string | null };

export type Loaded = {
  jurnal: typeof jurnals.$inferSelect;
  ownerAccountId: string;
  subject: typeof accounts.$inferSelect;
  access: Access;
  /** All sections and metrics of the jurnal (owner view); callers must filter through `access`. */
  allSections: (typeof sections.$inferSelect)[];
  allMetrics: (typeof metrics.$inferSelect)[];
};

/**
 * Load a jurnal and decide, once, what this viewer may see. Everything that reads jurnal data
 * (feed, trends, export, comments, alerts) starts here. Throws notFound if the viewer has no access,
 * so a jurnal's existence is not revealed to strangers.
 */
export async function loadForViewer(db: Db, jurnalId: string, viewer: Viewer): Promise<Loaded> {
  const [row] = await db
    .select({ jurnal: jurnals, owner: owners })
    .from(jurnals)
    .innerJoin(owners, eq(owners.id, jurnals.ownerId))
    .where(eq(jurnals.id, jurnalId));
  if (!row) throw notFound();

  const [subject] = await db.select().from(accounts).where(eq(accounts.id, row.owner.accountId));
  const allSections = await db.select().from(sections).where(eq(sections.jurnalId, jurnalId)).orderBy(sections.position);
  const sectionIds = allSections.map((s) => s.id);
  const allMetrics = sectionIds.length
    ? await db.select().from(metrics).where(inArray(metrics.sectionId, sectionIds)).orderBy(metrics.position)
    : [];

  const viewerGrants = viewer.accountId
    ? await db
        .select()
        .from(grants)
        .where(and(eq(grants.jurnalId, jurnalId), eq(grants.granteeId, viewer.accountId)))
    : [];

  const access = computeAccess({
    jurnal: { id: row.jurnal.id, ownerAccountId: row.owner.accountId, defaultPrecision: row.jurnal.defaultPrecision },
    sections: allSections.map((s) => ({ id: s.id, protected: s.protected })),
    metrics: allMetrics.map((m) => ({ id: m.id, sectionId: m.sectionId, protected: m.protected })),
    viewer: {
      accountId: viewer.accountId,
      presentedLinkValid: !!viewer.linkToken && !!row.jurnal.linkToken && viewer.linkToken === row.jurnal.linkToken,
    },
    grants: viewerGrants.map((g) => ({
      scope: g.scope,
      scopeId: g.scopeId,
      commentPerm: g.commentPerm,
      canAlert: g.canAlert,
      precision: g.precision,
    })),
  });
  if (access.role === "none") throw notFound();
  return { jurnal: row.jurnal, ownerAccountId: row.owner.accountId, subject, access, allSections, allMetrics };
}

export async function requireOwner(db: Db, accountId: string, jurnalId: string): Promise<Loaded> {
  const loaded = await loadForViewer(db, jurnalId, { accountId });
  if (loaded.access.role !== "owner") throw notFound(); // don't reveal the jurnal to non-owners
  return loaded;
}
