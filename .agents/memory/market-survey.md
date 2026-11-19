---
name: market-survey
description: Prior-art survey for Jurnal v2 (2026-11-19): nothing covers it, closest apps, reusable parts, risks
metadata:
  type: reference
---

Subagent survey on 2026-11-19 (about 20 searches; several buckets thin, so verify before relying on them).

- No existing app covers the whole idea. Closest: Bearable (custom factors, clinician export only), My PT Hub
  (coach dashboard with an overdue check-in list, no verified automatic coach push), wger (open source, AGPL,
  workouts and diet, no generic metrics or sharing). Exist.io and Perfice (open source) cover custom metrics only.
- The niche "alert a third party when something does NOT happen" looks unfilled in an integrated journal.
  Trainerize coaches request it on its ideas forum. MacroFactor is deliberately "adherence neutral".
- Reusable: our own cron + rule table (or Healthchecks.io) for missed-entry detection, Web Push + FCM, Bubblewrap
  for the Play wrapper, Open Food Facts / USDA plus an LLM vision API for macros.
- Risks: FTC Health Breach Notification Rule applies to non-HIPAA health apps; Android push is best-effort, so
  absence detection must be server-side; Play personal accounts need a closed test with 12+ testers for 14
  days, plus a health declaration and privacy policy; TWA notification delegation needs real-device testing;
  consent and revocation design for negative alerts; AI macro estimates underestimate by roughly 250-350 kcal.

See [[v2-requirements]].
