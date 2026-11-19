// Apply database migrations: `pnpm db:migrate` (uses DATABASE_URL, default is the local dev database).
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "../src/db/client";

async function main() {
  const db = createDb(process.env.DATABASE_URL ?? "postgres://jurnal@localhost:54329/jurnal");
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.pool.end();
  console.log("migrated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
