---
name: daily-sheet-export
description: "Temporary daily, semi-manual export of the Fitness jurnal into the coach's Google Sheet (from 2026-11-20, about a week)"
metadata:
  node_type: memory
  type: project
  originSessionId: df0e7ff0-cb51-4da5-85fd-2aa453398762
  modified: 2026-11-24T16:33:06.774Z
---

From 2026-11-20, for about a week, Jonathan asks an agent once a day (at the end of the day, in this session or a fresh one) to copy new entries from the Fitness jurnal (via the jurnal MCP) into the coach's sheet. The sheet's rules, cell map and `sheet.py` are in `~/notes/areas/fitness/` (CLAUDE.md there). It's a stopgap until the app's own Sheet export (release 2.2, see [[v2-requirements]]).

- Export the **Fitness** jurnal only, never Habits.
- Dry run first: read the entries, read the Day tabs, list only what's missing, with calorie estimates in column J, and write only after he approves. The sheet's existing contents are the record of what's been done: skip lines already in it, and never overwrite a filled cell without asking.
- Leave out context lines that aren't food or activity (e.g. "got Briana's plan", "porch, sun, planned my tasks"). He said so on 2026-11-20.
- Exported through 2026-11-23: every app line up to the Nov 23 8:41 AM chips-and-salsa breakfast (done 2026-11-24). Photos are fetched with `get_photo` (it may need `/mcp` reconnect after deploys).
- Naps stay out of the Activity Log. A whole-day calorie estimate he gives goes in that day's first-meal Journal (B18/J18); items logged that day then get no J value of their own, so they don't read as extra (Day 5).
- MCP servers in this checkout (2026-11-24): `jurnal` uses a read-only token; `jurnalrw` uses a read+entries token, for writing back to the app. Nov 23's Diet log has a line added 2026-11-24 with his whole-day note; it's already in the sheet (Day 5 B18), so skip it.
- Coding goes in the Activity Log as "Coding at standing desk", Low.

**Why:** he wants to do it semi-manually for a while before building anything.
**How to apply:** don't build automation for it (a `sheet-sync.json` ledger, a `/sheet-export` skill) unless he asks. He liked those ideas but turned them down for now.
