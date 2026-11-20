import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { createDb, type Db } from "@/db/client";
import { upsertAccount } from "@/server/journal";

let db: Db | undefined;

export async function testDb(): Promise<Db> {
  if (!db) {
    db = createDb(process.env.TEST_DATABASE_URL ?? "postgres://jurnal@localhost:54329/jurnal_test");
    await migrate(db, { migrationsFolder: "drizzle" });
  }
  await db.execute(
    sql`truncate table "account", "owner", "jurnal", "section", "metric", "entry", "entry_value", "asset", "grant", "invite", "comment", "reminder_rule", "alert_firing", "push_subscription", "api_token" restart identity cascade`,
  );
  return db;
}

export const makeAccount = (db: Db, name: string, timezone = "America/New_York") =>
  upsertAccount(db, { email: `${name.toLowerCase()}@example.com`, name }).then(async (a) => {
    await db.execute(sql`update "account" set timezone = ${timezone} where id = ${a.id}`);
    return { ...a, timezone };
  });
