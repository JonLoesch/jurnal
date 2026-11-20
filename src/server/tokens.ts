import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { apiTokens, type TokenScope } from "@/db/schema";
import { UserError, notFound } from "./errors";

export const TOKEN_SCOPES: { scope: TokenScope; label: string }[] = [
  { scope: "read", label: "Read jurnals and entries" },
  { scope: "entries", label: "Make and edit entries" },
  { scope: "settings", label: "Edit jurnals, sections and metrics" },
];

export const DEFAULT_TOKEN_DAYS = 365;
const MAX_TOKEN_DAYS = 1095;
const MAX_TOKENS = 20;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Make a token. The plain text is returned once and never stored. Writing scopes imply reading. */
export async function createToken(
  db: Db,
  accountId: string,
  input: { name: string; scopes: TokenScope[]; days?: number },
  now = new Date(),
) {
  const name = input.name.trim();
  if (!name) throw new UserError("Name the token so you can tell it apart later");
  const days = input.days ?? DEFAULT_TOKEN_DAYS;
  if (!Number.isInteger(days) || days < 1 || days > MAX_TOKEN_DAYS) throw new UserError(`Expiry must be 1 to ${MAX_TOKEN_DAYS} days`);
  const scopes = [...new Set<TokenScope>(["read", ...input.scopes])];
  if (scopes.some((s) => !TOKEN_SCOPES.some((t) => t.scope === s))) throw new UserError("Unknown permission");
  const live = await listTokens(db, accountId);
  if (live.filter((t) => !t.revokedAt && t.expiresAt > now).length >= MAX_TOKENS) throw new UserError("Too many active tokens: revoke some first");

  const token = `jt_${randomBytes(32).toString("base64url")}`;
  const [row] = await db
    .insert(apiTokens)
    .values({
      accountId,
      name,
      tokenHash: hash(token),
      prefix: token.slice(0, 9),
      scopes,
      expiresAt: new Date(now.getTime() + days * 86_400_000),
    })
    .returning();
  return { token, row };
}

export async function listTokens(db: Db, accountId: string) {
  return db.select().from(apiTokens).where(eq(apiTokens.accountId, accountId)).orderBy(desc(apiTokens.createdAt));
}

export async function revokeToken(db: Db, accountId: string, tokenId: string, now = new Date()) {
  const done = await db
    .update(apiTokens)
    .set({ revokedAt: now })
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.accountId, accountId), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id });
  if (done.length === 0) throw notFound();
}

/** Who does this bearer token speak for? Null if it is unknown, revoked or expired. */
export async function verifyToken(db: Db, bearer: string | undefined, now = new Date()) {
  if (!bearer || !bearer.startsWith("jt_")) return null;
  const [row] = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, hash(bearer)));
  if (!row || row.revokedAt || row.expiresAt <= now) return null;
  // Note when it was last used, at most every few minutes, so a busy session isn't a write per request.
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > 5 * 60_000) {
    await db.update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, row.id));
  }
  return { tokenId: row.id, accountId: row.accountId, scopes: row.scopes };
}
