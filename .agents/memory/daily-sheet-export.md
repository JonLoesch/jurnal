---
name: daily-sheet-export
description: "Temporary daily, semi-manual export of the Fitness jurnal into the coach's Google Sheet (from 2026-11-20, about a week)"
metadata:
  node_type: memory
  type: project
  originSessionId: df0e7ff0-cb51-4da5-85fd-2aa453398762
  modified: 2026-11-20T23:08:06.062Z
---

From 2026-11-20, for about a week, Jonathan asks an agent once a day (at the end of the day, in this session or a fresh one) to copy new entries from the Fitness jurnal (via the jurnal MCP) into the coach's sheet. The sheet's rules, cell map and `sheet.py` are in `~/notes/areas/fitness/` (CLAUDE.md there). It's a stopgap until the app's own Sheet export (release 2.2, see [[v2-requirements]]).

- Export the **Fitness** jurnal only, never Habits.
- Dry run first: read the entries, read the Day tabs, list only what's missing, with calorie estimates in column J, and write only after he approves. The sheet's existing contents are the record of what's been done: skip lines already in it, and never overwrite a filled cell without asking.
- Leave out context lines that aren't food or activity (e.g. "got Briana's plan", "porch, sun, planned my tasks"). He said so on 2026-11-20.
- Nov 19 and 20 up to the 3:27 PM kielbasa were already in the sheet on 2026-11-20. That night's party food was still to be logged in the app.

**Why:** he wants to do it semi-manually for a while before building anything.
**How to apply:** don't build automation for it (a `sheet-sync.json` ledger, a `/sheet-export` skill) unless he asks. He liked those ideas but turned them down for now.
