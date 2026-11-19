import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

export function createDb(url: string) {
  const pool = new Pool({ connectionString: url, max: 5 });
  return Object.assign(drizzle(pool, { schema }), { pool });
}

let shared: Db | undefined;

/** The app's database connection, created on first use. */
export function getDb(): Db {
  shared ??= createDb(process.env.DATABASE_URL ?? "postgres://jurnal@localhost:54329/jurnal");
  return shared;
}
