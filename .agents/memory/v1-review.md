---
name: v1-review
description: "What v1 (branch origin/v1_abandoned) still offered v2, from a full read on 2026-11-20, and what Jonathan decided"
metadata:
  node_type: memory
  type: project
  originSessionId: 7e14106a-0dfa-4239-adc9-5af431de6946
  modified: 2026-11-20T21:02:45.759Z
---

v1 lives on the remote branch `origin/v1_abandoned` (T3 stack: Next pages router, tRPC, Prisma, Quill; 2023-09 to 2024-01).
A full read on 2026-11-20 found its big idea already in v2 (metric groups became sections, see [[v2-requirements]]).
Nothing else in v1 is worth mining; don't re-review it.

Decisions (2026-11-20):
- **Kept, for the TODO:** a **metric description** shown as the question when logging (e.g. "Did you refrain from
  eating when you weren't hungry?"), and **anchored scale labels** (v1's 0-10 sliders labelled some points, such as
  "3: I at least got outdoors", so ratings stay consistent over months; fits `metric.config`).
- **Build now:** **new-entry notifications to followers** (v1 emailed subscribers about yesterday's posts; v2 had
  only absence alerts). No need to ask the coach first. Handed to the code session (`jurnal-2d`) with a design: a
  daily digest rule kind, any grantee may opt in, day-level so it respects grant precision.
- **Dropped:** importing his v1 metric set (Morning / Evening / Weekly routines in v1's `prisma/seed.ts`). He'd
  rather build his metric set from scratch.

**Why:** so later sessions don't re-read dead code or re-pitch the dropped idea.
