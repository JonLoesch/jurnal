# Jurnal

A web app (installable PWA) for keeping jurnals: fitness, habits, a diary, anything. You choose what to
track, get reminded when you forget, and share with the people you pick. Followers can also be told when
a jurnal goes quiet.

**Not a place for private health information or messaging.** There is no end-to-end encryption.

Licensed under the AGPL-3.0 (see `LICENSE`). Design notes: `docs/plan.md`.

## Develop

Needs Node 22, pnpm and Postgres 17.

```bash
pnpm install
cp .env.example .env.local        # then edit
# a throwaway local Postgres, if you don't have one (port 54329):
initdb -D .pgdata -U jurnal --auth=trust && ./scripts/db-start.sh
psql -h localhost -p 54329 -U jurnal -d postgres -c 'create database jurnal' -c 'create database jurnal_test'
pnpm db:migrate
pnpm dev                          # http://localhost:3000, with the local dev login
```

| Command | What it does |
|---|---|
| `pnpm test` | Unit and integration tests (needs `TEST_DATABASE_URL`) |
| `pnpm e2e` | Browser tests against a separate database (`E2E_DATABASE_URL`), using Chrome |
| `pnpm typecheck`, `pnpm lint` | Static checks |
| `pnpm db:generate` | After editing `src/db/schema.ts`, write a new migration into `drizzle/` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` |

## Configuration

See `.env.example`. In production:

- `DATABASE_URL`: Postgres connection string.
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `APP_URL`: sign-in with Google.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: web push (`pnpm exec web-push generate-vapid-keys`).
- `CRON_SECRET`: a scheduler must `POST /api/cron/tick` every minute with `Authorization: Bearer $CRON_SECRET`.
- `UPLOAD_DIR`: where photos are stored (local disk for now; swap `src/server/storage.ts` for object storage).
- `AUTH_DEV_LOGIN=1` enables a no-password login for local development only; it is ignored in production builds.

## How it fits together

- `src/lib`: pure logic with unit tests: timezones, schedules, field types, the access check (`access.ts`), the reminder rules (`rules.ts`).
- `src/server`: services over Postgres. Every read of jurnal data goes through `gate.ts`, which applies the access check.
- `src/app`: pages and server actions. Vercel builds run `pnpm db:migrate` first (`vercel-build`).
