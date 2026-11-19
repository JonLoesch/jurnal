import Link from "next/link";
import { getDb } from "@/db/client";
import { requireAccountId } from "@/server/session";
import { requireOwner } from "@/server/gate";
import { listAlertsOnMyJurnal } from "@/server/alerts";
import { listGrants, listInvites, sharingWarnings } from "@/server/sharing";
import { Flash, button, card, input, linkButton } from "../../../_components";
import {
  createInviteAction,
  grantProtectedAction,
  revokeGrantAction,
  revokeInviteAction,
  setPublicLinkAction,
  updateGrantAction,
} from "../../../actions";

export default async function SharingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const { id } = await params;
  const { error, invite } = await searchParams;
  const accountId = await requireAccountId();
  const db = getDb();
  const { jurnal, allSections, allMetrics } = await requireOwner(db, accountId, id);
  const [grants, invites, alerts, warnings] = await Promise.all([
    listGrants(db, accountId, id),
    listInvites(db, accountId, id),
    listAlertsOnMyJurnal(db, accountId, id),
    sharingWarnings(db, accountId, id),
  ]);
  const base = process.env.APP_URL ?? "";
  const followers = grants.filter((g) => g.grant.scope === "jurnal");
  const protectedTargets = [
    ...allSections.filter((s) => s.protected).map((s) => ({ value: `section:${s.id}`, label: `Section: ${s.name}` })),
    ...allMetrics.filter((m) => m.protected).map((m) => ({ value: `metric:${m.id}`, label: `Metric: ${m.name}` })),
  ];
  const nameOf = (scope: string, scopeId: string) =>
    scope === "section" ? allSections.find((s) => s.id === scopeId)?.name : allMetrics.find((m) => m.id === scopeId)?.name;

  return (
    <div className="space-y-8">
      <p><Link href={`/j/${id}`} className={linkButton}>← {jurnal.name}</Link></p>
      <h1 className="text-2xl font-semibold">Sharing</h1>
      <Flash error={error} />
      {invite && (
        <Flash>
          Invite link (shown once): <code className="break-all">{base}/invite/{invite}</code>
        </Flash>
      )}
      {warnings.hasProtectedItems && (
        <div role="note" className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          This jurnal has protected items ({[...warnings.protectedSections, ...warnings.protectedMetrics].join(", ")}). People you
          share the jurnal with can&apos;t see them unless you also give them access below.
        </div>
      )}

      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold">Invite someone</h2>
        <form action={createInviteAction} className="flex flex-wrap items-end gap-3 text-sm">
          <input type="hidden" name="jurnalId" value={id} />
          <label>Comments<br /><select name="commentPerm" className={input}><option value="none">None</option><option value="read">Can read</option><option value="write">Can read and write</option></select></label>
          <label>Sees<br /><select name="precision" className={input}><option value="">Jurnal default ({jurnal.defaultPrecision === "day" ? "dates" : "times"})</option><option value="day">Dates only</option><option value="time">Dates and times</option></select></label>
          <label>Expires in (days)<br /><input type="number" name="days" min="1" defaultValue="7" className={`${input} w-20`} /></label>
          <label>Uses<br /><input type="number" name="maxUses" min="1" defaultValue="1" className={`${input} w-16`} /></label>
          <label className="flex items-center gap-1"><input type="checkbox" name="canAlert" /> May set alerts when I go quiet</label>
          <button className={button}>Create invite link</button>
        </form>
        <ul className="text-sm">
          {invites.filter((i) => !i.revokedAt && i.expiresAt > new Date() && i.uses < i.maxUses).map((i) => (
            <li key={i.id} className="flex gap-3">
              <span>Open invite, expires {i.expiresAt.toLocaleDateString()}, {i.uses}/{i.maxUses} used</span>
              <form action={revokeInviteAction}><input type="hidden" name="jurnalId" value={id} /><input type="hidden" name="inviteId" value={i.id} /><button className={linkButton}>Revoke</button></form>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold">People with access</h2>
        {followers.length === 0 && <p className="text-sm text-neutral-500">No one yet.</p>}
        {followers.map(({ grant, name, email }) => (
          <div key={grant.id} className="space-y-2 border-b border-neutral-200 pb-3 text-sm last:border-0 dark:border-neutral-800">
            <p className="font-medium">{name} <span className="font-normal text-neutral-500">{email}</span></p>
            <form action={updateGrantAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="jurnalId" value={id} /><input type="hidden" name="grantId" value={grant.id} />
              <label>Comments<br /><select name="commentPerm" defaultValue={grant.commentPerm} className={input}><option value="none">None</option><option value="read">Can read</option><option value="write">Can read and write</option></select></label>
              <label>Sees<br /><select name="precision" defaultValue={grant.precision ?? ""} className={input}><option value="">Jurnal default</option><option value="day">Dates only</option><option value="time">Dates and times</option></select></label>
              <label className="flex items-center gap-1"><input type="checkbox" name="canAlert" defaultChecked={grant.canAlert} /> May set alerts</label>
              <button className={button}>Save</button>
            </form>
            <p className="text-xs text-neutral-500">
              Protected access: {grants.filter((g) => g.grant.granteeId === grant.granteeId && g.grant.scope !== "jurnal").map((g) => nameOf(g.grant.scope, g.grant.scopeId)).join(", ") || "none"}
            </p>
            {protectedTargets.length > 0 && (
              <form action={grantProtectedAction} className="flex gap-2">
                <input type="hidden" name="jurnalId" value={id} /><input type="hidden" name="granteeId" value={grant.granteeId} />
                <select name="target" className={input}>{protectedTargets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
                <button className={linkButton}>Give access</button>
              </form>
            )}
            <form action={revokeGrantAction}><input type="hidden" name="jurnalId" value={id} /><input type="hidden" name="grantId" value={grant.id} /><button className="text-red-700 underline">Remove access</button></form>
          </div>
        ))}
      </section>

      <section className={`${card} space-y-2`}>
        <h2 className="font-semibold">Alerts others have set on this jurnal</h2>
        {alerts.length === 0 && <p className="text-sm text-neutral-500">None. People you allow to set alerts are notified, not you, when this goes quiet.</p>}
        <ul className="text-sm">
          {alerts.map(({ rule, followerName }) => (
            <li key={rule.id}>{followerName}: notified after {(rule.config as { days: number }).days} days with nothing logged</li>
          ))}
        </ul>
      </section>

      <section className={`${card} space-y-2`}>
        <h2 className="font-semibold">Public link</h2>
        <p className="text-sm text-neutral-500">Anyone with the link can read the unprotected parts, dates only. It isn&apos;t listed anywhere.</p>
        {jurnal.linkToken && <p className="text-sm"><code className="break-all">{base}/p/{jurnal.linkToken}</code></p>}
        <form action={setPublicLinkAction}>
          <input type="hidden" name="jurnalId" value={id} /><input type="hidden" name="enabled" value={jurnal.linkToken ? "no" : "yes"} />
          <button className={button}>{jurnal.linkToken ? "Turn off public link" : "Create public link"}</button>
        </form>
      </section>
    </div>
  );
}
