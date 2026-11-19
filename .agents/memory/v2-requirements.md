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

**Why:** Jonathan keeps missing diet journal entries; the app should record and remind. See [[project-context]].
**How to apply:** treat these as settled unless he reopens them; open items are the stack choice, data model and the market survey result.
