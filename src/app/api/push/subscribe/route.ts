import { getDb } from "@/db/client";
import { savePushSubscription } from "@/server/alerts";
import { UserError } from "@/server/errors";
import { currentAccountId } from "@/server/session";

export async function POST(req: Request) {
  const accountId = await currentAccountId();
  if (!accountId) return new Response("Sign in first", { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: string; p256dh?: string; auth?: string } | null;
  if (!body?.endpoint || !body.p256dh || !body.auth) return new Response("Bad subscription", { status: 400 });
  try {
    await savePushSubscription(getDb(), accountId, { endpoint: body.endpoint, p256dh: body.p256dh, auth: body.auth });
  } catch (e) {
    if (e instanceof UserError) return new Response(e.message, { status: 400 });
    throw e;
  }
  return Response.json({ ok: true });
}
