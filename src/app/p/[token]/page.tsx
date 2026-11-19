import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jurnals } from "@/db/schema";
import { currentAccountId } from "@/server/session";
import { JurnalView } from "../../_jurnal-view";

/** Public, link-only view of a jurnal. */
export default async function PublicJurnal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [j] = await getDb().select({ id: jurnals.id }).from(jurnals).where(eq(jurnals.linkToken, token));
  if (!j) notFound();
  return <JurnalView jurnalId={j.id} viewer={{ accountId: await currentAccountId(), linkToken: token }} searchParams={{}} />;
}
