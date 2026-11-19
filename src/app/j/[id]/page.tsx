import { currentAccountId } from "@/server/session";
import { JurnalView } from "../../_jurnal-view";

export default async function JurnalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; from?: string; firing?: string }>;
}) {
  const { id } = await params;
  return <JurnalView jurnalId={id} viewer={{ accountId: await currentAccountId() }} searchParams={await searchParams} />;
}
