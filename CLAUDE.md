# Jurnal

A web app for recording diet, fitness and exercise thoughts and reminding Jonathan to record them.
Context: `.agents/memory/project-context.md` and `~/notes/areas/fitness/`.

# Agent memory

Agent memory for this project lives in `.agents/memory/` (one fact per file, plus a `MEMORY.md`
index). The files are part of the repo: commit them with the work they came from. Keep it to project
facts; notes about one person's own setup or preferences belong in that person's local notes.

Claude Code needs one line per checkout to use it, in the untracked `.claude/settings.local.json`:
`"autoMemoryDirectory": "<path to this checkout>/.agents/memory"` (an absolute path or one starting
with `~/`).
