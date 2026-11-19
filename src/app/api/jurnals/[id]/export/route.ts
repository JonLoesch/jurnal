import { getDb } from "@/db/client";
import { UserError } from "@/server/errors";
import { exportJurnal, toCsv } from "@/server/journal";
import { currentAccountId } from "@/server/session";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accountId = await currentAccountId();
  if (!accountId) return new Response("Sign in first", { status: 401 });
  const format = new URL(req.url).searchParams.get("format") === "json" ? "json" : "csv";
  try {
    const data = await exportJurnal(getDb(), id, { accountId });
    const name = data.jurnal.replace(/[^\w-]+/g, "_") || "jurnal";
    if (format === "json")
      return new Response(JSON.stringify(data, null, 2), {
        headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${name}.json"` },
      });
    return new Response(toCsv(data.rows), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"` },
    });
  } catch (e) {
    if (e instanceof UserError) return new Response("Not found", { status: 404 });
    throw e;
  }
}
