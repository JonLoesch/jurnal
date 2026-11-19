import { getDb } from "@/db/client";
import { UserError } from "@/server/errors";
import { photoAccess } from "@/server/journal";
import { currentAccountId } from "@/server/session";
import { storage } from "@/server/storage";

/** Photos are served only through the access check: they inherit their metric's visibility. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const linkToken = new URL(req.url).searchParams.get("link");
  try {
    const asset = await photoAccess(getDb(), id, { accountId: await currentAccountId(), linkToken });
    const bytes = await storage.get(asset.storageKey);
    return new Response(Buffer.from(bytes), {
      headers: { "content-type": asset.contentType, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" },
    });
  } catch (e) {
    if (e instanceof UserError) return new Response("Not found", { status: 404 });
    throw e;
  }
}
