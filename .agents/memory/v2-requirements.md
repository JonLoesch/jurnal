---
name: v2-requirements
description: Jurnal v2 product decisions from the 2026-11-19 planning session (scope, auth, metrics, reminders, privacy, stack)
metadata:
  type: project
---

"v1" = Jonathan's earlier half-built Jurnal (dropped; only the name and design goals carry over). "v2" = this greenfield app.

Decisions so far (planning stage, nothing built):
- **N-to-N multi-user.** Anyone signs up, anyone invites others, people grant each other follow-access to private / semi-private / public journals. Access controls need to be fairly fine-grained.
- **All entry types in v2:** workouts (plans, weights, ad-hoc, routines, soreness/tiredness), diet (meal + time, rough macros, optional mood), habits, free-text diary.
- **Metrics are user-defined:** name + field type (free text, 1-5 stars, yes/no, number, ...) + frequency. Retiring a metric must keep old data viewable and chartable. Trends, basic charts, export.
- **Reminders:** real push on Android when the app is closed; snoozable and dismissable. Coaches/followers set the rules for reminders sent to the person they follow (e.g. nothing logged in 3 days). "Negative" notifications (something did NOT happen) are the key idea, for self and for followers.
- **Coach comments on entries:** interesting, wanted; coach view otherwise read-only.
- **Auth:** OAuth for all accounts for now.
- **Macros** from photo/text/voice: deferred to v2.1; pitch ideas.
- **Coach's Google Sheet export:** deferred; build as an export adapter later.
- **Privacy:** no end-to-end encryption for now. If it ever goes public, it must clearly state it is NOT an appropriate platform for private health data / messaging.
- **Platform:** PWA first (Android user), later Google Play (even unlisted) via a wrapper. Postgres is fine; other stack is my pick (he won't read or write much code), prefer well-established choices.
- Hosting: a cloud free tier. Possible later: free public app with donations.
- **Multiple jurnals per user** (fitness, chess, coding...), each with its own metrics, frequencies and sharing: private diary, shared with a close group, partly shared with a select group, partly public. Comment read/write visibility is a separate setting. Expect many access-control settings; some visibility may be per entry or per metric.
- **Frequencies:** "N times a week", "daily at these 3 times", shortcuts like "meal times" and "weekdays".
- **Photo upload is in v2.0**; macro estimation from photos/text/voice is v2.1+ (LLM vision + nutrition database, editable draft with ranges). He doesn't much care about macro accuracy (open question).
- **Notification channels are pluggable:** v2.0 web push only (easiest); design for email, SMS, voice, Discord, Slack later. Absence detection runs server-side.
- **Invites:** invite links preferred as the easiest flow; approval-based follows undecided.
- **Therapy-adjacent features are 3.0 or later.** Exercise/diet journaling is v2. (Not legal advice: consumer fitness apps are generally outside HIPAA, but the FTC Health Breach Notification Rule can apply.)
- **Absence alerts:** an alert only ever notifies the follower who set it (never the subject); anything the follower then does about it (nudge, call) happens outside the app. A trigger may only use data its owner can already read, with resolution capped at what they can see; "may set alerts" is a permission in the share grant, off by default. Subjects can see which alerts exist on them. Social pressure for positive change is the deliberate goal; he is unsure it's a good idea, so keep it for now and be ready to remove it.
- **Public = link-only** (no discoverable/browsable public jurnals for now).
- **Ownership must not block organizations later:** a jurnal's owner should be abstract (user now, org possibly later). Multi-writer shared jurnals are not v2.0 scope but the data model must allow them.
- **Photos live inside a rich-text field** and inherit its access control. No special mood-while-eating feature (a free-text metric covers it).
- **Access model:** primary case is per-jurnal access. Per-entry visibility is rejected (too confusing). Optional, default-off "protected" flag that needs its own ACL on top of jurnal access; the ACL admin UI warns when a jurnal contains protected items, and the protected item's page warns if anyone with access lacks jurnal access.
- **Sections** (from v1 experience): a jurnal is divided into sections (e.g. morning / evening of one daily update) that read as ONE chronological blog but have their own frequencies, deadlines and reminders (e.g. morning by 10AM, evening by 9PM); jurnal-wide ones exist too. Protection may belong to sections. UI is jurnal > sections only, no deeper nesting; implementation (recursive or not) is my call.
- **Access check** is the AND of three levels: jurnal access (grant, or link-public), then section, then metric; a section or metric marked protected needs its own ACL entry, otherwise it inherits. Metric-level protection stays alongside section-level. Archive/retire applies to both metrics and sections. The default section is a hidden implementation detail (UI shows only jurnals and sections).
- **Entries** belong to a section; fields: timeAdded, timeUpdated (no per-edit history) and a user-editable effective time (backfill, e.g. logging yesterday's entry today). Default time accuracy is days ("Nov 4", not the time); settable at jurnal level, possibly per grant.
- **"Late" is not stored on entries.** It comes from reminder rules (viewer-specific) and means a missing data point since the last entry. Likely UI: an overdue banner for viewers whose alert has fired; an adherence calendar derived from the section's own expected frequency is a later idea.

**Why:** Jonathan keeps missing diet journal entries; the app should record and remind. See [[project-context]].
**How to apply:** treat these as settled unless he reopens them; open items are the stack choice, data model and the market survey result.
