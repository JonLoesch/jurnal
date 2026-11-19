# Jurnal v2: plan

Status (2026-11-19, evening): M0 to M5 are built and tested locally (see "Build status" at the end). Nothing is deployed. Decisions behind this plan are in
`.agents/memory/v2-requirements.md`; prior art is in `.agents/memory/market-survey.md`.

## 1. What we're building

A multi-user web app (PWA; Google Play is a someday item) where anyone keeps one or more **jurnals**
(fitness, chess, coding...), each with user-defined metrics, schedules and reminders, and shares them
with chosen people at chosen levels. The distinctive part: followers can be told when something does
**not** happen, and so can you. Not for private health data; no therapy features before 3.0.

## 2. Stack (my picks; he won't read much code)

| Piece | Choice | Why |
|---|---|---|
| App | Next.js (App Router) + TypeScript | Mainstream; same family as his rrm project |
| UI | Tailwind + shadcn/ui, Tiptap for rich text, Recharts for charts | Established, no custom design system |
| Database | Postgres (Neon free tier) via Drizzle ORM | He chose Postgres; Drizzle keeps SQL visible |
| Auth | Auth.js with Google OAuth first | OAuth for everyone, per his decision |
| Push | `web-push` library (VAPID), service worker | Works for an installed Android PWA; no Firebase project needed for the PWA |
| Scheduler | A per-minute external trigger (e.g. a Cloudflare Worker cron) calling a secured endpoint | Vercel Hobby cron is limited to once a day; verify current limits before building |
| Photos | Object storage (Cloudflare R2 or Vercel Blob), served only through an ACL-checked route | Free-tier quota is the first limit we'll hit |
| Tests | Vitest for the access check and rule evaluator, Playwright for flows | Access control is the part that must not be wrong |
| Hosting | Vercel + Neon, on the default `*.vercel.app` domain | Hobby tier is fine until donations start; we'd move to a paid tier by then |
| CI/CD | GitHub Actions + Vercel's GitHub integration | See section 8 |

Nothing here is bleeding-edge. Everything with a free-tier caveat is flagged to verify at M0.

## 3. Data model

Names are placeholders. All ids are UUIDs; all times are UTC except effective dates.

- **account**: login (OAuth identity), display name, timezone (one per account), week start day,
  notification settings.
- **owner**: what owns a jurnal. v2.0 has only `kind = account`. Jurnals reference an owner, never an
  account directly, so organizations can be added later without touching jurnals.
- **jurnal**: owner, name, default precision (`day` unless changed), `link_token` (link-only public
  access, nullable), archived flag.
- **section**: jurnal, name, order, `protected`, archived, schedule (see below). Every jurnal has one
  hidden **default section**; the UI shows sections only when a jurnal has more than one.
- **metric**: section, name, field type, config (unit, target such as 3 sets of 10, choices),
  `protected`, archived. Archiving a metric or section never deletes values.
- **entry**: section, author account, `effective_date` (a calendar date), optional `effective_time`,
  `added_at`, `updated_at`. Effective date can be edited (backfill) but never in the future.
- **entry_value**: entry, metric, value (JSON, validated per field type), plus a numeric copy
  (`value_num`) so charts and trends are plain SQL.
- **asset**: a photo, belonging to a metric value of a rich-text field, so it inherits that metric's
  access. No standalone photo URLs.
- **grant**: scope (`jurnal`, `section` or `metric`), grantee (an account or an invite), read level,
  comment permission (none, read, write), `can_alert`, precision override.
- **invite**: token (stored hashed), the grant it creates, optional expiry and use count.
- **comment**: entry, author, body, visibility.
- **reminder_rule**: owner account, target (jurnal or section), kind (`self` or `follower_absence`),
  threshold, deadline/delivery time of day, channels.
- **alert_firing**: rule, fired_at, the latest entry at that moment, snoozed_until, dismissed_at.
  A delivery log, not a state machine: "is it overdue now?" is computed.
- **notification_channel**: account, type (`web_push` now), endpoint data. Interface-based so email,
  SMS, Slack and others can be added.

Field types for v2.0: text, rich text (with photos), number (with unit), stars (1 to 5), yes/no,
choice, time of day, duration, and **sets** (a list of reps and weight pairs, for exercises).

### Frequency spec

One small structure used by sections and rules: `count` per `day` or `week`, optional weekdays,
optional explicit times of day. Shortcuts: "weekdays", "meal times". "3 times a week" and "daily at
these 3 times" are both instances of it.

## 4. Access check

A viewer may read a metric's values in a jurnal only if **all** of these hold:

1. they own the jurnal, or have a jurnal grant, or the jurnal's `link_token` was presented;
2. the section is not `protected`, or they have a section grant;
3. the metric is not `protected`, or they have a metric grant.

Rules that keep this safe:

- **One gate.** Every read goes through a single access module that returns what a viewer may see for
  a jurnal (sections, metrics, precision). Route handlers never query entries directly.
- **Precision is enforced on the server.** For a day-precision viewer the API drops
  `effective_time`, `added_at` and `updated_at`.
- **Trends and alerts use the same gate.** You can chart or alert only on what you can read.
- **Grants can't dangle.** A section or metric grant requires a jurnal grant; the UI offers to add
  it. The admin screens warn when a jurnal contains protected items.
- **No per-entry visibility.** Rejected as too confusing.

The access function gets an exhaustive test table before any UI depends on it.

## 5. Reminder engine

A scheduler hits an endpoint every minute. For each active rule it evaluates a pure function of
(rule, latest entry, now, subject timezone) and, when a rule is due and has no matching firing
record, sends through the channel interface and writes an `alert_firing`.

- **Self reminders** come from a section's schedule plus a deadline ("log by 10AM"). Deadlines use
  the subject's timezone.
- **Follower absence alerts** ("nothing for 2 days") need the follower's `can_alert` grant, notify
  only the follower, and evaluate at the follower's precision (day-level means after the day ends,
  at a delivery time of day that the rule sets, default a reasonable hour).
- **Revocation:** a revoked grant makes its rules dormant.
- **Transparency:** subjects can see which alerts exist on their jurnals and who set them.
- **Overdue state:** computed. A banner shows "no entry since Nov 15" to viewers whose alert has
  fired. Alert links carry `?from=alert`; if a newer entry exists, the page shows a toast.
- **Snooze and dismiss** live on the firing record. Failed push (expired subscription) removes the
  subscription and is logged.
- Because the engine is server-side, a missing push never looks like absence.

## 6. Milestones

Order is chosen so you can start using it early: your pain is forgetting to log, so solo logging and
self reminders come before sharing.

- **M0, foundations.** Repo, Next.js, Neon, Auth.js with Google, deploy, CI, PWA shell. Verify
  free-tier limits (cron, storage, Vercel terms).
- **M1, solo journaling.** Jurnals, hidden default section, sections, metrics with all field types,
  entries with editable effective date, timezone handling, feed view by day then section, archive,
  rich text with photo upload.
- **M2, trends and export.** Per-metric charts and trend lines, per-jurnal summary, CSV and JSON
  export (also your backup).
- **M3, self reminders (dogfood checkpoint).** Frequency spec, rules, scheduler, Web Push, snooze and
  dismiss, overdue banner. Test on a real Android phone as an installed PWA. Start using it daily.
- **M4, sharing.** Grants, invite links, link-only public access, the access module and its tests,
  precision per grant, comments, the advanced section and metric ACLs with warnings.
- **M5, follower alerts.** `can_alert`, follower rules, transparency view.
- **v2.1.** Macro estimates from photo, text or voice (editable draft, ranges, nutrition database);
  printable workout sheet; adherence calendar; extra notification channels.
- **Later, no date.** Google Play via a TWA wrapper (Bubblewrap). Punted: PWA until further notice. When
  it comes back: $25 fee, a closed test (12+ testers for 14 days) for a new personal account, a
  privacy policy and Play's health declaration. A public launch also needs the visible "not for private
  health data" notice.

## 7. Risks and decisions to confirm

- **Free-tier limits** (cron frequency, photo storage, Vercel Hobby terms) are unverified: check at M0.
- **Android push** is best-effort; the installed PWA must be tested on a real phone at M3.
- **Health-data rules:** the FTC Health Breach Notification Rule can apply to health apps. Avoid
  medical claims and get a legal read before any clinician features or a public launch.
- **Abuse:** public links and comments need a way to block and report; keep comments off by default.
- **Data safety:** no end-to-end encryption in v2.0; say so. Accounts need deletion and export.
- **Decided:** open source (license to confirm: see section 8); name "Jurnal"; domain TBD (vercel.app
  until at least v2.1); invites expire after 7 days by default (single use unless the owner allows more;
  always revocable); default alert delivery hour 10AM in the recipient's timezone; comments attach to
  entries, not sections.

## 8. CI/CD and open source

- **Repo:** public on GitHub, with the license chosen before the first push. Decided: AGPL-3.0
  (keeps hosted forks open; wger uses it).
- **Secrets:** never committed. They live in Vercel and GitHub settings, with a `.env.example` listing
  names only.
- **On every pull request** (GitHub Actions): lint, type check, unit tests (including the access
  module's table) against a Postgres service container, a production build, and Playwright flows.
- **Previews:** Vercel builds a preview per PR. Neon can give each PR its own database branch, so
  migrations are tried on a copy of the schema before they touch production (verify at M0).
- **On merge to `main`:** Vercel deploys to production, and database migrations run as a step before
  the new code goes live. A failing migration blocks the deploy.
- **Branch protection:** `main` requires the CI checks to pass.
- **Dependencies:** Dependabot (or Renovate) opens update PRs; CI is what lets us merge them safely.
- **The reminder trigger** (Cloudflare Worker) is a small separate piece with its own deploy step in
  Actions.
- **Note:** commits made by agents stay local; he pushes, and CI runs from his pushes.

## 9. Build status (2026-11-19)

Built on branch `build/v2-core`, tested locally only (93 unit/integration tests, 3 browser tests).

| Milestone | State |
|---|---|
| M0 foundations | Done except the hosted pieces: Next.js 16, Drizzle migrations, Auth.js (Google plus a local-only dev login), GitHub Actions CI, Dependabot, AGPL license. Vercel, Neon and Google OAuth are not set up. |
| M1 solo journaling | Done: jurnals, hidden default section, sections, all field types, backfill, feed, archive, photos (local disk). Notes are plain text plus photos: no rich-text editor yet. |
| M2 trends and export | Done: per-metric chart with trend line, CSV and JSON export. |
| M3 self reminders | Done in code: rules, scheduler endpoint, Web Push sender, snooze, dismiss, overdue banner, `?from=alert` toast. Not tested on a phone, and no real push has been sent. |
| M4 sharing | Done: invites (7-day, single-use default), grants, protected sections and metrics, precision per grant, public link, comments, warnings. |
| M5 follower alerts | Done: permission flag, follower rules, owner transparency list. |

Not done yet: hosting and secrets, the per-minute scheduler trigger, object storage for photos, a
rich-text editor, the printable workout sheet and the other v2.1 items.
