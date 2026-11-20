# Jurnal TODO (2026-11-20)

v2.0 is deployed. This list replaces the generic "v2.1": work is split into three releases by purpose, and
each item is tagged by how much manual (non-AI) effort it needs.

- **Manual** = only Jonathan can do it (accounts, consoles, decisions, other people).
- **Mixed** = AI does the work but needs a short manual step or a decision.
- **AI only** = code; Jonathan reviews and pushes.

Sources: the v2 plan (`docs/plan.md`), what we hit while deploying, and the diet/fitness thread
(`~/notes/areas/fitness/jurnal.md`, raw messages from 2026-11-19 to 2026-11-20 10:41, plus the coach's sheet
conventions in that folder's `CLAUDE.md`). The fitness data is what the app has to hold, so it drives the order.

**Already built since v2.0** (local, waiting for a push and deploy; see git log):
- Account deletion, Blob photo storage, new-entry digests for followers.
- **Running-log metric** (`log` type): timestamped lines added through the day, with photos, one entry per day.
- **MCP endpoint** (`/api/mcp`) with personal access tokens made in Settings: scopes read / make and edit entries /
  edit jurnals, sections and metrics; one year default expiry (1 to 1095 days); revocable; hashed at rest. Tools go
  through the same access checks as the web app.
- **Seed** for Jonathan's Fitness and Habits jurnals (`scripts/seed-jurnals.ts`, safe to rerun).

## Release split

| Release | Purpose | Done when |
|---|---|---|
| **2.1 Daily driver** | Replace the Claude-thread-to-sheet routine for Jonathan alone | He logs a day of meals, activity and a workout in the app, reminders nudge him, and his two days of history are in it |
| **2.2 Share with the coach** | Briana (and anyone else) can use it | A second real account follows a jurnal, comments, and gets an alert; the coach's sheet fills itself |
| **2.3 Smart capture** | Less typing | A pasted paragraph or photo becomes a draft entry he edits and approves |
| **Later** | No date | Items at the bottom |

## What the fitness data tells us the app needs

These come straight from the logged days. Each is tied to a task below.

- **Workouts are circuits with targets**: Briana's lower-body day is 3 circuits of exercises, each "3 sets, 7 to 12
  reps at a weight you can handle", with exceptions (toe raises 20+, plank about 30 s). Logged results look like
  `10x165`, `11x90`, `8 x body weight`, `12x30 kettlebell`, `30 x body weight (261)`, "barely 30 s". So: sets need a
  **body weight** option and an equipment note, exercises need **targets and grouping into circuits**, and an
  exercise can be **skipped with a reason** (no trap bar, no step-up crates).
- **Food is eyeballed**: "about a cup", "a third ish", "ate a fifth", "4 squeezed lemons, about 3 oz cranberry juice".
  Amounts are free text, never precise. Leftovers get eaten across several entries ("ate a third, then a fifth").
- **Calorie estimates were requested, provisionally** ("we might use it or delete it later"), in the coach sheet's column J.
- **Grazing is continuous**: "rice snacks all day, about two cups total". One entry with a rough total beats many.
- **Non-food activity matters**: a walk with a neighbor, 10 minutes of stretching, hours at a standing desk ("sort of
  an activity"), a morning routine (porch sun, planning the day). Activities have a start, end and intensity.
- **Timestamps are fuzzy**: the message time is not the event time; events are backfilled. The app's
  effective time versus added time already handles this.
- **Photos belong to entries**: 8 photos so far (5, 2, 1) are sitting in Claude's upload folder.
- **The coach's sheet is the real consumer today**: a 14-day form with food groups per meal block (Protein, Veggies,
  Carbs, Fats, Drinks, Journal) and an activity log. He is feeding it through Claude by hand, which is the thing the
  app should replace. Free-text paragraphs that "should be parsed for structured data" are already how he thinks.
- **Open questions he parked**: how detailed to get on amounts; whether macros are wanted at all; whether the coach
  wants numbers (the README's "Ask the coach" item).

## Manual (Jonathan only)

Do these when convenient; none blocks the code work except the first.

- [ ] **Push `development`** (carries the account deletion, Blob storage, `@types/node` 22, Dependabot rule and docs)
      and merge into `main` so production matches.
- [ ] **Close Dependabot PR #6** (`@types/node` 26). Leave **#7 (TypeScript 6) open as a reminder**; revisit in a few months.
- [ ] **Rotate the Neon password** (it was pasted into a Claude session): Neon console, Reset password, update
      `DATABASE_URL` in Vercel and `.env.local`. He chose to wait; the cost is that the old password is in a transcript.
- [ ] **Confirm the Blob store says Private** in Vercel (Storage, the store, Settings).
- [ ] **Google OAuth consent screen**: check its publishing status. In Testing, only listed test users can sign in.
      Needed before anyone else logs in (2.2).
- [ ] **Delete the stale `jurnal-jonloesch` callback URI** from the Google OAuth client, and remove the old
      `build/v2-core` branch (local and remote).
- [ ] **Cancel the dothethang.com renewal** (already on the personal list).
- [ ] **Talk to Briana** (the README's "Ask the coach"): does she want macro numbers? Is a separate "Macros" tab OK?
      Would she use the app at all? This decides the shape of 2.2.
- [ ] **Decide the data-privacy stance for inviting her** (the "not for private health data" notice is in place on the login page; she is a fitness client, so confirm he is comfortable).
- [ ] **Check Neon's backup and retention on the free tier.** Until we know, the per-jurnal CSV/JSON export is the only backup.
- [ ] **Later, if it goes public:** domain, privacy policy, Google Play (already punted).

## 2.1 Daily driver

Mixed

- [ ] **Import the fitness history** (jurnal.md and the sheet's Day 1 and Day 2). Needs his decision on how to map it
      (below), a review of the draft, and optionally the 8 photos copied from `~/.claude/uploads`. AI writes the
      import script and runs it locally, then against production only on his go.
- [ ] **Reminders for his real jurnals** (the jurnals themselves are seeded; reminders are not, since he has not said when): Diet and Fitness (and a Diary), sections for
      morning, midday and evening, and self reminders at the times he actually forgets. This is configuration, but
      it needs him to say which times and which metrics. Dogfood for a week; what annoys him shapes the rest.
- [ ] **Try the alert toast, snooze and dismiss on the phone** (the push itself is verified; these paths are not).
- [ ] **Per-minute trigger**: currently every 5 minutes from cron-job.org. Fine; change only if a reminder feels late.

AI only

- [ ] **Reminder form rework**: the section's "How often / Times" and the "Remind me" deadline are two separate forms.
      Fold them into one ("Daily at these times, remind me if I haven't logged by +30 min"). He hit this
      and lost a test run on it.
- [ ] **Sets with body weight and equipment**: reps x weight, `body weight`, a free note (kettlebell, guide bar),
      "barely 30 s" as a duration set. Extends the `sets` type, no schema change expected.
- [ ] **Exercise targets and circuits**: a workout section where exercises are grouped, each with a target
      (3 x 7-12, 20+, 30 s), and a skipped-with-reason state. This is also the base for the printable workout sheet.
- [ ] **Printable workout sheet** (his handwritten page, laser printer): a print view of that section, filled in as
      a normal entry afterward.
- [ ] **Activities**: start, end, intensity (matches the coach sheet's activity log); standing-desk hours as a normal metric.
- [ ] **Metric description**: optional text shown under the metric's name as the question when logging ("Did you
      refrain from eating when you weren't hungry?"). A new field on the metric; from the v1 review.
- [ ] **Anchored scale labels**: optional text on scale points (v1 had "0 Not at all / 3 I at least got outdoors /
      10 Enough to feel good and tired"), so ratings stay consistent over months. Fits `metric.config`, no schema change.
      From the v1 review.
- [ ] **Quick capture**: one text box on the home screen, "log something now", saved as a plain note on the right
      jurnal with the time, to be sorted later. This is the cheapest answer to "I forget to write it down".
- [ ] **Rich-text notes**: a Tiptap editor (plain text plus photos today). Photos inline.
- [ ] **Export everything** in one download (all jurnals plus photos), and import for the same format. Also a
      backup story.
- [ ] **Leftovers helper**: "ate a third" as a fraction of a previous meal. Low priority; free text works today.
- [ ] **Error visibility**: log server errors somewhere he can see (Vercel logs are enough at first, so write down where).
- [ ] **Browser tests against the Vercel preview**, so a deploy is checked, not just the local build.

## 2.2 Share with the coach

Manual

- [ ] **Second Google account or Briana herself** to try sharing, invites, the protected section, comments and a
      follower alert for real. The code is tested locally; it has never met a real second person.
- [ ] **Coach agrees to the sheet export** (she is already an editor of the sheet via the service account).

Mixed

- [ ] **Sheet export adapter**: write the app's entries into the coach's Google Sheet in her existing layout
      (Day tabs, meal blocks, activity log, optional calorie column). The service account and the cell map already
      exist in `~/notes/areas/fitness/`. AI builds it; he confirms the mapping and the coach is fine with it.
- [ ] **Coach view polish**: what Briana sees on a phone, how comments read, what an alert says. Needs his feedback after she tries it.
- [ ] **Try the new-entry digest with a real follower** (built and tested locally): a follower turns on "Tell me about
      new entries" and gets one push a day, at their hour, only if something was added the day before.
- [ ] **Abuse basics before wider invites**: block or report on comments and public links.

AI only

- [ ] **Account export link** on the settings page ("download everything"), reusing the 2.1 export.
- [ ] **Invite flow polish**: expiry and revoke visibility, "you were invited by X" screen.
- [ ] **Neon branch per pull request**, so migrations are tried on a copy first (plan section 8; unverified on the free tier).

## 2.3 Smart capture

Mixed (each needs an API key or a budget decision from him)

- [ ] **Paste-a-paragraph parsing**: he sends the same kind of free text he sends Claude now; the app drafts entries
      (meal, foods by group, amounts as given, activity, workout sets) for him to edit and approve. Needs an
      Anthropic API key and a spend cap in Vercel, and a decision on whether his text may leave the app.
- [ ] **Photo to macro draft** with ranges and an editable result, if he and the coach want numbers at all.
- [ ] **Voice capture**, if the phone's built-in dictation isn't enough.

AI only

- [ ] **Nutrition database lookup** behind the macro draft.
- [ ] **Adherence calendar** (derived from the section's expected frequency).

## Later, no date

- Extra notification channels (email via Resend, which he already has a key for; Slack; Discord; SMS).
- Google Play via a wrapper (punted until further notice).
- Organizations as jurnal owners (the data model already allows it).
- Therapy-adjacent features (3.0 or later).
- Discoverable public jurnals (decided against for now).

## Suggested order

1. Push and merge (Manual, 5 minutes); close #6; confirm Blob is private.
2. Reminder form rework and quick capture (AI), then set up real jurnals and reminders and **live in it for a week**.
3. Sets with body weight, exercise targets and circuits, activities (AI), so a workout can be logged the way Briana's plan reads.
4. Import the history, once the metrics it maps to exist (Mixed).
5. Talk to Briana. Then the second-user test, then the sheet export adapter (2.2).
6. Smart capture only after a week or two of real logging shows what he actually types.

## Open questions for Jonathan

- How should the history map: one **Diet** jurnal and one **Fitness** jurnal, or a single **Journal** with sections?
  (Suggested: two jurnals; the sheet is organized the same way.)
- Is one raw verbatim text metric per message enough for the import, or should the AI split each message into structured entries (meal, activity, workout) first? (Suggested: structured, with the raw text kept in a note.)
- Calorie estimates: keep, or drop? He called it provisional. (Suggested: skip until the coach answers.)
- `jurnal.md` ends at 2026-11-20 10:41. If the other thread has newer entries, the export needs a refresh before import.
