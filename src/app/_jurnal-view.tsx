import Link from "next/link";
import { getDb } from "@/db/client";
import { getFeed, type FeedEntry } from "@/server/journal";
import { alertLinkStatus } from "@/server/alerts";
import type { Viewer } from "@/server/gate";
import { formatDate, Flash, MetricInput, ValueView, button, card, input, linkButton } from "./_components";
import {
  addCommentAction,
  createAbsenceRuleAction,
  createDigestRuleAction,
  createEntryAction,
  deleteCommentAction,
  deleteEntryAction,
  updateEntryAction,
} from "./actions";
import { describeSchedule } from "@/lib/formvalues";
import { dateIn } from "@/lib/time";
import { orNotFound } from "@/server/page";

export async function JurnalView({
  jurnalId,
  viewer,
  searchParams,
}: {
  jurnalId: string;
  viewer: Viewer;
  searchParams: { error?: string; from?: string; firing?: string };
}) {
  const db = getDb();
  const { loaded, feed } = await orNotFound(getFeed(db, jurnalId, viewer));
  const { access, jurnal, allSections, allMetrics, subject } = loaded;
  const isOwner = access.role === "owner";
  const sections = allSections.filter((s) => access.sectionIds.has(s.id) && !s.archivedAt);
  const sectionById = new Map(allSections.map((s) => [s.id, s]));
  const metricById = new Map(allMetrics.map((m) => [m.id, m]));
  const showSectionNames = allSections.filter((s) => !s.isDefault).length > 0;
  const today = dateIn(subject.timezone, new Date());

  let toast: string | null = null;
  if (searchParams.from === "alert" && searchParams.firing && viewer.accountId) {
    try {
      const status = await alertLinkStatus(db, viewer.accountId, searchParams.firing);
      if (status.newerEntryExists) toast = "Something new has been logged since that alert fired.";
    } catch {
      /* stale link: ignore */
    }
  }

  const byDay = new Map<string, FeedEntry[]>();
  for (const e of feed) byDay.set(e.effectiveDate, [...(byDay.get(e.effectiveDate) ?? []), e]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">{jurnal.name}</h1>
        <nav className="flex gap-4 text-sm">
          {viewer.accountId && <Link href={`/j/${jurnalId}/trends`} className={linkButton}>Trends</Link>}
          {isOwner && <Link href={`/j/${jurnalId}/sharing`} className={linkButton}>Sharing</Link>}
          {isOwner && <Link href={`/j/${jurnalId}/settings`} className={linkButton}>Manage</Link>}
          {viewer.accountId && <a href={`/api/jurnals/${jurnalId}/export?format=csv`} className={linkButton}>Export</a>}
        </nav>
      </div>
      <Flash error={searchParams.error} />
      <Flash>{toast}</Flash>
      {!isOwner && (
        <p className="text-sm text-neutral-500">
          Shared by {subject.name}. {access.precision === "day" ? "You see dates, not times." : "You see dates and times."}
          {access.hasHidden && " Some parts of this jurnal are private."}
        </p>
      )}

      {isOwner && (
        <section className="space-y-3">
          {sections.map((s) => {
            const sm = allMetrics.filter((m) => m.sectionId === s.id && !m.archivedAt);
            return (
              <details key={s.id} className={card} open={sections.length === 1}>
                <summary className="cursor-pointer font-medium">
                  Add entry{showSectionNames ? `: ${s.name}` : ""}
                  <span className="ml-2 text-xs font-normal text-neutral-500">{describeSchedule(s.schedule)}</span>
                </summary>
                {sm.length === 0 ? (
                  <p className="mt-2 text-sm text-neutral-500">
                    No metrics yet. <Link className="underline" href={`/j/${jurnalId}/settings`}>Choose what to track.</Link>
                  </p>
                ) : (
                  <form action={createEntryAction} className="mt-3 space-y-3">
                    <input type="hidden" name="jurnalId" value={jurnalId} />
                    <input type="hidden" name="sectionId" value={s.id} />
                    {sm.map((m) => (
                      <label key={m.id} className="block text-sm">
                        <span className="mb-1 block font-medium">{m.name}</span>
                        <MetricInput metric={m} />
                      </label>
                    ))}
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Date</span>
                      <input type="date" name="date" max={today} defaultValue={today} className={input} />
                      <span className="ml-2 text-xs text-neutral-500">Change it to log something you forgot.</span>
                    </label>
                    <button className={button}>Save entry</button>
                  </form>
                )}
              </details>
            );
          })}
        </section>
      )}

      {access.role === "grantee" && (
        <details className={card}>
          <summary className="cursor-pointer text-sm font-medium">Tell me about new entries</summary>
          <form action={createDigestRuleAction} className="mt-3 flex flex-wrap items-end gap-3 text-sm">
            <input type="hidden" name="jurnalId" value={jurnalId} />
            <label>Send me a daily summary at<br /><input type="time" name="notifyAt" defaultValue="10:00" className={input} /></label>
            <button className={button}>Turn on</button>
          </form>
          <p className="mt-2 text-xs text-neutral-500">Once a day, only if something new was added yesterday. It says how many, not what, and only counts what you can see here.</p>
        </details>
      )}

      {access.canAlert && (
        <details className={card}>
          <summary className="cursor-pointer text-sm font-medium">Tell me when this goes quiet</summary>
          <form action={createAbsenceRuleAction} className="mt-3 flex flex-wrap items-end gap-3 text-sm">
            <input type="hidden" name="jurnalId" value={jurnalId} />
            <label>Days with nothing logged<br /><input type="number" name="days" min="1" defaultValue="2" className={`${input} w-20`} /></label>
            <label>Tell me at<br /><input type="time" name="notifyAt" defaultValue="10:00" className={input} /></label>
            <button className={button}>Add alert</button>
          </form>
          <p className="mt-2 text-xs text-neutral-500">Only you are notified. It counts only what you can see here, and whole days only.</p>
        </details>
      )}

      <section className="space-y-6">
        {feed.length === 0 && <p className="text-sm text-neutral-500">Nothing here yet.</p>}
        {[...byDay.entries()].map(([date, items]) => (
          <div key={date}>
            <h2 className="mb-2 border-b border-neutral-200 pb-1 text-sm font-semibold text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">{formatDate(date)}</h2>
            <ul className="space-y-3">
              {items.map((e) => (
                <li key={e.id} className={card}>
                  <div className="mb-2 flex items-baseline justify-between text-xs text-neutral-500">
                    <span>{showSectionNames ? sectionById.get(e.sectionId)?.name : ""}{e.effectiveTime ? ` ${e.effectiveTime}` : ""}</span>
                  </div>
                  <dl className="space-y-1 text-sm">
                    {e.values.map((v) => {
                      const m = metricById.get(v.metricId)!;
                      return (
                        <div key={v.metricId} className="flex gap-2">
                          <dt className="w-32 shrink-0 text-neutral-500">{m.name}{m.archivedAt ? " (retired)" : ""}</dt>
                          <dd className="min-w-0 flex-1"><ValueView metric={m} value={v.value} /></dd>
                        </div>
                      );
                    })}
                  </dl>
                  {isOwner && (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-neutral-500">Edit</summary>
                      <form action={updateEntryAction} className="mt-2 space-y-2">
                        <input type="hidden" name="jurnalId" value={jurnalId} />
                        <input type="hidden" name="entryId" value={e.id} />
                        {allMetrics.filter((m) => m.sectionId === e.sectionId && (!m.archivedAt || e.values.some((v) => v.metricId === m.id))).map((m) => (
                          <label key={m.id} className="block"><span className="mb-1 block font-medium">{m.name}</span>
                            <MetricInput metric={m} value={e.values.find((v) => v.metricId === m.id)?.value} /></label>
                        ))}
                        <label className="block"><span className="mb-1 block font-medium">Date</span>
                          <input type="date" name="date" max={today} defaultValue={e.effectiveDate} className={input} /></label>
                        <div className="flex gap-3"><button className={button}>Save changes</button></div>
                      </form>
                      <form action={deleteEntryAction} className="mt-2">
                        <input type="hidden" name="jurnalId" value={jurnalId} /><input type="hidden" name="entryId" value={e.id} />
                        <button className="text-sm text-red-700 underline">Delete entry</button>
                      </form>
                    </details>
                  )}
                  {(e.comments.length > 0 || access.commentPerm === "write") && (
                    <div className="mt-3 space-y-1 border-t border-neutral-200 pt-2 text-sm dark:border-neutral-800">
                      {e.comments.map((c) => (
                        <div key={c.id}><strong>{c.authorName}</strong>: {c.body}
                          {viewer.accountId && (
                            <form action={deleteCommentAction} className="ml-2 inline">
                              <input type="hidden" name="jurnalId" value={jurnalId} /><input type="hidden" name="commentId" value={c.id} />
                              <button className="text-xs text-neutral-400 underline">remove</button>
                            </form>
                          )}
                        </div>
                      ))}
                      {access.commentPerm === "write" && (
                        <form action={addCommentAction} className="flex gap-2">
                          <input type="hidden" name="jurnalId" value={jurnalId} /><input type="hidden" name="entryId" value={e.id} />
                          <input name="body" placeholder="Add a comment" className={`${input} flex-1`} />
                          <button className={button}>Post</button>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
