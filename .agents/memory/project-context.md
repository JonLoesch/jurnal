---
name: project-context
description: Why Jurnal exists and how work on it is split between a code thread and a thought-journal thread
metadata:
  type: project
---

Jurnal (restarted 2026-11-19) is meant to be a web app that helps Jonathan record diet, fitness and
exercise thoughts, and to remind him to record them. He had missed many entries in the coach's
nutrition journal sheet (see `~/notes/areas/fitness/`, which already has a dispatcher + `sheet.py`
logging path).

Work is split into two conversations: this repo's sessions build the code; a separate session collects
the thoughts themselves, and they get loaded into the app's DB once it exists.

**Why:** the real failure is forgetting to log, so reminders matter more than storage.
**How to apply:** don't mix thought-journal content into code sessions. Before building, push back on
scope per `~/notes/areas/me/README.md` (check existing tools, propose a smallest test). Open
questions as of 2026-11-19: capture method, where it runs, and whether the coach's sheet is still the
destination.

**Build state (2026-11-19):** M0-M5 of `docs/plan.md` were built locally in one session on branch
`build/v2-core` (Next.js 16, Drizzle, local Postgres on port 54329 via `scripts/db-start.sh`, Playwright with
system Chrome). Hosted pieces (Vercel, Neon, Google OAuth, Cloudflare cron, real push on a phone) are not
set up; Jonathan does those later.
