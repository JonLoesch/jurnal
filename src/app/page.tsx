import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { accounts, grants, jurnals } from "@/db/schema";
import { currentAccountId } from "@/server/session";
import { listMyJurnals } from "@/server/journal";
import { Flash, button, card, input } from "./_components";
import { createJurnalAction, leaveJurnalAction } from "./actions";
import { TimezoneNudge } from "./timezone-nudge";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const accountId = await currentAccountId();
  if (!accountId) {
    return (
      <div className="space-y-4 py-10">
        <h1 className="text-3xl font-semibold">Jurnal</h1>
        <p>Keep jurnals for fitness, habits, or anything else. Choose what to track, get reminded when you forget, and share with the people you pick.</p>
        <Link href="/login" className={button}>Sign in</Link>
      </div>
    );
  }
  const db = getDb();
  const [me] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  const mine = await listMyJurnals(db, accountId);
  const following = await db
    .select({ id: jurnals.id, name: jurnals.name })
    .from(grants)
    .innerJoin(jurnals, eq(jurnals.id, grants.jurnalId))
    .where(eq(grants.granteeId, accountId));
  const followed = following.filter((f, i, a) => a.findIndex((x) => x.id === f.id) === i);
  return (
    <div className="space-y-8">
      <Flash error={error} />
      <TimezoneNudge current={me.timezone} name={me.name} weekStart={me.weekStart} />
      <section>
        <h2 className="mb-3 text-lg font-semibold">Your jurnals</h2>
        <ul className="mb-4 space-y-2">
          {mine.map((j) => (
            <li key={j.id} className={card}>
              <Link href={`/j/${j.id}`} className="font-medium underline-offset-2 hover:underline">{j.name}</Link>
            </li>
          ))}
          {mine.length === 0 && <li className="text-sm text-neutral-500">No jurnals yet. Make one below.</li>}
        </ul>
        <form action={createJurnalAction} className="flex gap-2">
          <input name="name" required placeholder="New jurnal, e.g. Fitness" className={`${input} flex-1`} />
          <button className={button}>Create</button>
        </form>
      </section>
      {followed.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Shared with you</h2>
          <ul className="space-y-2">
            {followed.map((j) => (
              <li key={j.id} className={`${card} flex items-center justify-between`}>
                <Link href={`/j/${j.id}`} className="font-medium hover:underline">{j.name}</Link>
                <form action={leaveJurnalAction}><input type="hidden" name="jurnalId" value={j.id} /><button className="text-sm text-neutral-500 underline">Stop following</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
