import { getDb } from "@/db/client";
import { eq } from "drizzle-orm";
import { accounts } from "@/db/schema";
import { requireAccountId } from "@/server/session";
import { listMyRules } from "@/server/alerts";
import { Flash, button, card, input, linkButton } from "../_components";
import { deleteAccountAction, deleteRuleAction, updateAccountAction } from "../actions";
import { PushToggle } from "./push-toggle";

export default async function AccountSettings({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const accountId = await requireAccountId();
  const db = getDb();
  const [me] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  const rules = await listMyRules(db, accountId);
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [me.timezone];
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Flash error={error} />
      <section className={card}>
        <h2 className="mb-2 font-semibold">You</h2>
        <form action={updateAccountAction} className="flex flex-wrap items-end gap-3 text-sm">
          <label>Name<br /><input name="name" defaultValue={me.name} className={input} /></label>
          <label>Timezone<br /><select name="timezone" defaultValue={me.timezone} className={input}>{!zones.includes(me.timezone) && <option>{me.timezone}</option>}{zones.map((z) => <option key={z}>{z}</option>)}</select></label>
          <label>Week starts on<br /><select name="weekStart" defaultValue={me.weekStart} className={input}>
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>
          <button className={button}>Save</button>
        </form>
        <p className="mt-2 text-xs text-neutral-500">Update your timezone when you travel: reminder times and &quot;today&quot; follow it.</p>
      </section>
      <section className={card}>
        <h2 className="mb-2 font-semibold">Notifications</h2>
        <PushToggle publicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
      </section>
      <section className={card}>
        <h2 className="mb-2 font-semibold">Your reminders and alerts</h2>
        <ul className="space-y-1 text-sm">
          {rules.map(({ rule, jurnalName }) => (
            <li key={rule.id} className="flex gap-3">
              <span>{jurnalName}: {ruleSummary(rule)}</span>
              <form action={deleteRuleAction}><input type="hidden" name="ruleId" value={rule.id} /><button className={linkButton}>Remove</button></form>
            </li>
          ))}
          {rules.length === 0 && <li className="text-neutral-500">None yet.</li>}
        </ul>
      </section>
      <section className={`${card} space-y-2 border-red-300`}>
        <h2 className="font-semibold text-red-800">Delete my account</h2>
        <p className="text-sm text-neutral-600">
          This permanently deletes your account, every jurnal you own, all entries and photos, your reminders, and the
          access you gave others. It can&apos;t be undone. Export anything you want to keep first, from each jurnal&apos;s
          page.
        </p>
        <form action={deleteAccountAction} className="flex flex-wrap items-end gap-3 text-sm">
          <label>Type <b>{me.email}</b> to confirm<br /><input name="confirm" autoComplete="off" className={`${input} w-72`} /></label>
          <button className="rounded bg-red-700 px-3 py-1.5 text-sm text-white">Delete everything</button>
        </form>
      </section>
    </div>
  );
}

function ruleSummary(rule: { kind: string; config: unknown }) {
  const c = rule.config as { deadline?: string; days?: number; notifyAt?: string };
  if (rule.kind === "self") return `log by ${c.deadline}`;
  if (rule.kind === "follower_digest") return `daily summary of new entries at ${c.notifyAt}`;
  return `tell me after ${c.days} quiet days`;
}
