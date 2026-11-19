import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db/client";
import { runTick } from "@/server/alerts";
import { defaultNotifier } from "@/server/notify";

/** Called every minute by an external scheduler with `Authorization: Bearer $CRON_SECRET`. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret)))
    return new Response("Unauthorized", { status: 401 });
  const db = getDb();
  return Response.json(await runTick(db, defaultNotifier(db)));
}
