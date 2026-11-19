import type { CommentPerm, Precision } from "@/db/schema";

/**
 * The single rule for who may see what in a jurnal. Pure: callers load the facts, this decides.
 * Every read path (feed, trends, export, alerts, photos) must go through `computeAccess`.
 *
 * A viewer sees a metric's values only if ALL hold:
 *   1. they own the jurnal, or have a jurnal grant, or presented the jurnal's public link;
 *   2. its section is not protected, or they hold a section grant;
 *   3. the metric is not protected, or they hold a metric grant.
 * Section and metric grants never help on their own: without level 1 they give nothing.
 */

export type GrantFact = {
  scope: "jurnal" | "section" | "metric";
  scopeId: string;
  commentPerm: CommentPerm;
  canAlert: boolean;
  precision: Precision | null;
};

export type AccessInput = {
  jurnal: { id: string; ownerAccountId: string; defaultPrecision: Precision };
  sections: { id: string; protected: boolean }[];
  metrics: { id: string; sectionId: string; protected: boolean }[];
  viewer: { accountId: string | null; presentedLinkValid: boolean };
  /** The viewer's own grants on this jurnal and its sections and metrics. */
  grants: GrantFact[];
};

export type Access = {
  role: "owner" | "grantee" | "link" | "none";
  precision: Precision;
  commentPerm: CommentPerm;
  canAlert: boolean;
  sectionIds: Set<string>;
  metricIds: Set<string>;
  /** True when some sections or metrics are hidden from this viewer by protection. */
  hasHidden: boolean;
};

const NONE: Access = {
  role: "none",
  precision: "day",
  commentPerm: "none",
  canAlert: false,
  sectionIds: new Set(),
  metricIds: new Set(),
  hasHidden: false,
};

export function computeAccess(input: AccessInput): Access {
  const { jurnal, sections, metrics, viewer, grants } = input;

  if (viewer.accountId && viewer.accountId === jurnal.ownerAccountId) {
    return {
      role: "owner",
      precision: "time",
      commentPerm: "write",
      canAlert: false, // the owner has no use for follower alerts on their own jurnal
      sectionIds: new Set(sections.map((s) => s.id)),
      metricIds: new Set(metrics.map((m) => m.id)),
      hasHidden: false,
    };
  }

  const jurnalGrant = viewer.accountId ? grants.find((g) => g.scope === "jurnal" && g.scopeId === jurnal.id) : undefined;
  if (!jurnalGrant && !viewer.presentedLinkValid) return NONE;

  const role = jurnalGrant ? "grantee" : "link";
  // Link-only visitors are anonymous: day precision, read only, no alerts, nothing protected.
  const held = (scope: "section" | "metric", id: string) =>
    role === "grantee" && grants.some((g) => g.scope === scope && g.scopeId === id);

  const sectionIds = new Set(sections.filter((s) => !s.protected || held("section", s.id)).map((s) => s.id));
  const metricIds = new Set(
    metrics.filter((m) => sectionIds.has(m.sectionId) && (!m.protected || held("metric", m.id))).map((m) => m.id),
  );

  return {
    role,
    precision: jurnalGrant?.precision ?? jurnal.defaultPrecision,
    commentPerm: jurnalGrant?.commentPerm ?? "none",
    canAlert: jurnalGrant?.canAlert ?? false,
    sectionIds,
    metricIds,
    hasHidden: sectionIds.size < sections.length || metricIds.size < metrics.length,
  };
}

export type EntryRow = {
  id: string;
  sectionId: string;
  authorId: string;
  effectiveDate: string;
  effectiveTime: string | null;
  addedAt: Date;
  updatedAt: Date;
};

export type EntryView = {
  id: string;
  sectionId: string;
  authorId: string;
  effectiveDate: string;
  effectiveTime?: string | null;
  addedAt?: Date;
  updatedAt?: Date;
};

/** Drop entries in hidden sections, and strip anything finer than the viewer's precision. */
export function viewEntries(access: Access, entries: EntryRow[]): EntryView[] {
  return entries
    .filter((e) => access.sectionIds.has(e.sectionId))
    .map((e) =>
      access.precision === "time"
        ? e
        : { id: e.id, sectionId: e.sectionId, authorId: e.authorId, effectiveDate: e.effectiveDate },
    );
}
