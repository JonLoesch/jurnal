import Link from "next/link";
import { getDb } from "@/db/client";
import { currentAccountId } from "@/server/session";
import { describeInvite } from "@/server/sharing";
import { button } from "../../_components";
import { redeemInviteAction } from "../../actions";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await describeInvite(getDb(), token);
  const accountId = await currentAccountId();
  if (!invite || !invite.usable)
    return <p className="py-10">This invite is no longer valid. Ask the person who sent it for a new one.</p>;
  return (
    <div className="space-y-4 py-10">
      <h1 className="text-2xl font-semibold">You&apos;re invited to follow “{invite.jurnalName}”</h1>
      {accountId ? (
        <form action={redeemInviteAction}>
          <input type="hidden" name="token" value={token} />
          <button className={button}>Accept</button>
        </form>
      ) : (
        <p>
          <Link href={`/login`} className="underline">Sign in</Link>, then open this link again to accept.
        </p>
      )}
    </div>
  );
}
