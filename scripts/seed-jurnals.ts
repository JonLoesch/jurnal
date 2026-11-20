import { getDb } from "../src/db/client";
import { eq } from "drizzle-orm";
import { accounts } from "../src/db/schema";
import { seedMyJurnals } from "../src/server/seed";

/** Usage: DATABASE_URL=... tsx scripts/seed-jurnals.ts you@example.com   (the account must have signed in once) */
async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: tsx scripts/seed-jurnals.ts <account email>");
  const db = getDb();
  const [account] = await db.select().from(accounts).where(eq(accounts.email, email.trim().toLowerCase()));
  if (!account) throw new Error(`No account for ${email}: sign in once first (a typo shouldn't create one)`);
  const created = await seedMyJurnals(db, account.id);
  console.log(created.length ? `Created:\n${created.map((c) => `  ${c}`).join("\n")}` : "Nothing to do: everything already exists.");
  await db.pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
