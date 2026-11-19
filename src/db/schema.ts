import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export type Precision = "day" | "time";
export type CommentPerm = "none" | "read" | "write";
export type GrantScope = "jurnal" | "section" | "metric";

export const accounts = pgTable("account", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  weekStart: integer("week_start").notNull().default(1), // ISO weekday, 1 = Monday
  createdAt: createdAt(),
});

// A jurnal belongs to an owner, never directly to an account, so organizations can be added later.
export const owners = pgTable("owner", {
  id: id(),
  kind: text("kind").$type<"account">().notNull().default("account"),
  accountId: uuid("account_id")
    .notNull()
    .unique()
    .references(() => accounts.id, { onDelete: "cascade" }),
});

export const jurnals = pgTable("jurnal", {
  id: id(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  defaultPrecision: text("default_precision").$type<Precision>().notNull().default("day"),
  linkToken: text("link_token").unique(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const sections = pgTable("section", {
  id: id(),
  jurnalId: uuid("jurnal_id")
    .notNull()
    .references(() => jurnals.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  protected: boolean("protected").notNull().default(false),
  schedule: jsonb("schedule").$type<Schedule | null>(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const metrics = pgTable("metric", {
  id: id(),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => sections.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  fieldType: text("field_type").$type<FieldType>().notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  protected: boolean("protected").notNull().default(false),
  position: integer("position").notNull().default(0),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const entries = pgTable(
  "entry",
  {
    id: id(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => accounts.id),
    effectiveDate: date("effective_date", { mode: "string" }).notNull(),
    effectiveTime: text("effective_time"), // "HH:MM" in the author's timezone, optional
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("entry_section_date").on(t.sectionId, t.effectiveDate)],
);

export const entryValues = pgTable(
  "entry_value",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    metricId: uuid("metric_id")
      .notNull()
      .references(() => metrics.id, { onDelete: "cascade" }),
    value: jsonb("value").$type<unknown>().notNull(),
    valueNum: doublePrecision("value_num"),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.metricId] }), index("entry_value_metric").on(t.metricId)],
);

// Photos belong to a metric value, so they inherit that metric's access rules.
export const assets = pgTable("asset", {
  id: id(),
  entryId: uuid("entry_id")
    .notNull()
    .references(() => entries.id, { onDelete: "cascade" }),
  metricId: uuid("metric_id")
    .notNull()
    .references(() => metrics.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  contentType: text("content_type").notNull(),
  bytes: integer("bytes").notNull(),
  createdAt: createdAt(),
});

export const grants = pgTable(
  "grant",
  {
    id: id(),
    jurnalId: uuid("jurnal_id")
      .notNull()
      .references(() => jurnals.id, { onDelete: "cascade" }),
    scope: text("scope").$type<GrantScope>().notNull(),
    scopeId: uuid("scope_id").notNull(),
    granteeId: uuid("grantee_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    commentPerm: text("comment_perm").$type<CommentPerm>().notNull().default("none"),
    canAlert: boolean("can_alert").notNull().default(false),
    precision: text("precision").$type<Precision>(), // null = use the jurnal default
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("grant_unique").on(t.scope, t.scopeId, t.granteeId), index("grant_grantee").on(t.granteeId)],
);

export const invites = pgTable("invite", {
  id: id(),
  jurnalId: uuid("jurnal_id")
    .notNull()
    .references(() => jurnals.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  commentPerm: text("comment_perm").$type<CommentPerm>().notNull().default("none"),
  canAlert: boolean("can_alert").notNull().default(false),
  precision: text("precision").$type<Precision>(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  maxUses: integer("max_uses").notNull().default(1),
  uses: integer("uses").notNull().default(0),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const comments = pgTable("comment", {
  id: id(),
  entryId: uuid("entry_id")
    .notNull()
    .references(() => entries.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const reminderRules = pgTable("reminder_rule", {
  id: id(),
  ownerAccountId: uuid("owner_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }), // who gets notified
  jurnalId: uuid("jurnal_id")
    .notNull()
    .references(() => jurnals.id, { onDelete: "cascade" }),
  sectionId: uuid("section_id").references(() => sections.id, { onDelete: "cascade" }),
  kind: text("kind").$type<"self" | "follower_absence">().notNull(),
  config: jsonb("config").$type<RuleConfig>().notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

// A delivery log, not a state machine: whether something is overdue now is computed.
export const alertFirings = pgTable(
  "alert_firing",
  {
    id: id(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => reminderRules.id, { onDelete: "cascade" }),
    dedupeKey: text("dedupe_key").notNull(),
    firedAt: timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
    lastEntryId: uuid("last_entry_id"),
    lastEffectiveDate: date("last_effective_date", { mode: "string" }),
    message: text("message").notNull(),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("alert_firing_dedupe").on(t.ruleId, t.dedupeKey)],
);

export const pushSubscriptions = pgTable("push_subscription", {
  id: id(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: createdAt(),
});

export type FieldType =
  | "text"
  | "richtext"
  | "number"
  | "stars"
  | "yesno"
  | "choice"
  | "timeofday"
  | "duration"
  | "sets";

export type Schedule = {
  count: number;
  period: "day" | "week";
  weekdays?: number[]; // ISO 1-7; only meaningful for period "day"
  times?: string[]; // "HH:MM" slots; only for period "day", count = times.length
};

export type RuleConfig =
  | { type: "deadline"; deadline: string } // self: log by HH:MM in the subject's timezone
  | { type: "absence"; days: number; notifyAt: string }; // follower: N complete silent days
