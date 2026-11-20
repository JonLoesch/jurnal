---
name: fitness-history-import
description: "How Jonathan's 2026-11-19/20 diet and fitness history was loaded into production, and the conventions it set"
metadata:
  type: project
---

On 2026-11-20 the raw chat log of the fitness session (not `jurnal.md` or the sheet) was imported into production with a one-off script (`scripts/import-entries.ts`, deleted afterwards; see git history, commits 9a37fb6 and cd01062). The plan file with his data lives outside the repo at `~/notes/areas/fitness/jurnal-import-plan.json`, untracked, because the repo is public. Four entries: Fitness / Activity (Nov 19 and 20, Diet and Other activity logs), Lower Body Workout (Nov 19, 17:45), Habits / Morning (Nov 20). Nine photos went to the private Blob store, shrunk to about 280 KB.

Conventions worth keeping:
- A log line's `at` is **when he sent the message**, not when the event happened; stated event times ("lunch at 12:30") are in the text. His own words are kept verbatim; only meta-chat to Claude was dropped.
- **Body-weight sets are stored as weight 0** and the Notes say "body weight". The plank is a `sets` metric with reps = seconds held. Exercises he skipped (Trap Bar RDL, 1 Leg Step Up) have no value; the reason is in the Notes.
- Calorie estimates (the sheet's column J) are not stored in the app. The daily export computes them, see [[daily-sheet-export]].
- Unknown habit answers stay blank rather than guessed ("Woke up at a reasonable time" on Nov 20).

**Why:** so later sessions reproduce the same choices when importing or exporting more of his data.
**How to apply:** if another batch is needed, recover the importer from git history. It was a dry run by default (`--apply` to write), validated every value first, and refused to touch a section and day that already had an entry.
