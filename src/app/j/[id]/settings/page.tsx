import Link from "next/link";
import { getDb } from "@/db/client";
import { requireAccountId } from "@/server/session";
import { requireOwner } from "@/server/gate";
import { orNotFound } from "@/server/page";
import { listMyRules } from "@/server/alerts";
import { FIELD_TYPES } from "@/lib/fieldtypes";
import { describeSchedule } from "@/lib/formvalues";
import { Flash, button, card, input, linkButton } from "../../../_components";
import {
  addMetricAction,
  addSectionAction,
  archiveJurnalAction,
  archiveSectionAction,
  createSelfRuleAction,
  deleteRuleAction,
  updateJurnalAction,
  updateMetricAction,
  updateSectionAction,
} from "../../../actions";

const PRESETS = [
  ["", "No schedule"],
  ["daily", "Daily"],
  ["weekdays", "Weekdays"],
  ["meal times", "Meal times (8:00, 12:30, 18:30)"],
  ["weekly:2", "2 times a week"],
  ["weekly:3", "3 times a week"],
  ["weekly:4", "4 times a week"],
  ["times", "Daily at these times:"],
] as const;

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const accountId = await requireAccountId();
  const db = getDb();
  const { jurnal, allSections, allMetrics } = await orNotFound(requireOwner(db, accountId, id));
  const rules = (await listMyRules(db, accountId)).filter((r) => r.rule.jurnalId === id && r.rule.kind === "self");
  const multi = allSections.length > 1;

  return (
    <div className="space-y-8">
      <p><Link href={`/j/${id}`} className={linkButton}>← {jurnal.name}</Link></p>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Flash error={error} />

      <section className={card}>
        <h2 className="mb-2 font-semibold">This jurnal</h2>
        <form action={updateJurnalAction} className="flex flex-wrap items-end gap-3 text-sm">
          <input type="hidden" name="jurnalId" value={id} />
          <label>Name<br /><input name="name" defaultValue={jurnal.name} className={input} /></label>
          <label>What followers see by default<br />
            <select name="precision" defaultValue={jurnal.defaultPrecision} className={input}>
              <option value="day">Dates only</option><option value="time">Dates and times</option>
            </select></label>
          <button className={button}>Save</button>
        </form>
      </section>

      {allSections.map((s) => {
        const metrics = allMetrics.filter((m) => m.sectionId === s.id);
        return (
          <section key={s.id} className={`${card} space-y-3 ${s.archivedAt ? "opacity-60" : ""}`}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{s.isDefault && !multi ? "What to track" : s.name}{s.archivedAt ? " (retired)" : ""}</h2>
              <span className="text-xs text-neutral-500">{describeSchedule(s.schedule)}</span>
            </div>

            {(multi || !s.isDefault) && (
              <form action={updateSectionAction} className="flex flex-wrap items-end gap-3 text-sm">
                <input type="hidden" name="jurnalId" value={id} /><input type="hidden" name="sectionId" value={s.id} />
                <input type="hidden" name="protectedPresent" value="1" />
                {!s.isDefault && <label>Section name<br /><input name="name" defaultValue={s.name} className={input} /></label>}
                <label>How often<br />
                  <select name="preset" defaultValue={presetOf(s.schedule)} className={input}>{PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label>Times<br /><input name="times" placeholder="07:30, 21:00" defaultValue={s.schedule?.times?.join(", ") ?? ""} className={`${input} w-32`} /></label>
                {!s.isDefault && <label className="flex items-center gap-1"><input type="checkbox" name="protected" defaultChecked={s.protected} /> Protected</label>}
                <button className={button}>Save section</button>
              </form>
            )}
            {s.isDefault && !multi && (
              <form action={updateSectionAction} className="flex flex-wrap items-end gap-3 text-sm">
                <input type="hidden" name="jurnalId" value={id} /><input type="hidden" name="sectionId" value={s.id} />
                <label>How often<br /><select name="preset" defaultValue={presetOf(s.schedule)} className={input}>{PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label>Times<br /><input name="times" placeholder="07:30, 21:00" defaultValue={s.schedule?.times?.join(", ") ?? ""} className={`${input} w-32`} /></label>
                <button className={button}>Save</button>
              </form>
            )}

            <ul className="space-y-1 text-sm">
              {metrics.map((m) => (
                <li key={m.id} className={`flex flex-wrap items-center gap-3 ${m.archivedAt ? "text-neutral-400 line-through" : ""}`}>
                  <span className="font-medium">{m.name}</span>
                  <span className="text-neutral-500">{FIELD_TYPES.find((t) => t.type === m.fieldType)?.label}</span>
                  <form action={updateMetricAction} className="flex items-center gap-2">
                    <input type="hidden" name="jurnalId" value={id} /><input type="hidden" name="metricId" value={m.id} />
                    <input type="hidden" name="protectedPresent" value="1" />
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="protected" defaultChecked={m.protected} /> Protected</label>
                    <button className={linkButton}>Update</button>
                  </form>
                  <form action={updateMetricAction}>
                    <input type="hidden" name="jurnalId" value={id} /><input type="hidden" name="metricId" value={m.id} />
                    <input type="hidden" name="archived" value={m.archivedAt ? "no" : "yes"} />
                    <button className={`${linkButton} text-neutral-500`}>{m.archivedAt ? "Bring back" : "Stop tracking"}</button>
                  </form>
                </li>
              ))}
            </ul>

            {!s.archivedAt && (
              <form action={addMetricAction} className="flex flex-wrap items-end gap-3 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-800">
                <input type="hidden" name="jurnalId" value={id} /><input type="hidden" name="sectionId" value={s.id} />
                <label>New metric<br /><input name="name" required placeholder="e.g. Sleep" className={input} /></label>
                <label>Type<br /><select name="fieldType" className={input}>{FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</select></label>
                <label>Unit<br /><input name="unit" placeholder="kg, lb" className={`${input} w-16`} /></label>
                <label>Choices<br /><input name="choices" placeholder="low, ok, high" className={`${input} w-32`} /></label>
                <label>Sets × reps<br />
                  <span className="flex gap-1"><input name="targetSets" type="number" min="1" placeholder="3" className={`${input} w-14`} /><input name="targetReps" type="number" min="1" placeholder="10" className={`${input} w-14`} /></span></label>
                <label className="flex items-center gap-1"><input type="checkbox" name="protected" /> Protected</label>
                <button className={button}>Add</button>
              </form>
            )}
            {!s.isDefault && (
              <form action={archiveSectionAction}>
                <input type="hidden" name="jurnalId" value={id} /><input type="hidden" name="sectionId" value={s.id} /><input type="hidden" name="archived" value={s.archivedAt ? "no" : "yes"} />
                <button className={`${linkButton} text-neutral-500`}>{s.archivedAt ? "Bring section back" : "Stop tracking this section"}</button>
              </form>
            )}
          </section>
        );
      })}

      <section className={card}>
        <h2 className="mb-2 font-semibold">Add a section</h2>
        <p className="mb-2 text-sm text-neutral-500">Sections split one jurnal into parts with their own schedule, like morning and evening. They read as one jurnal.</p>
        <form action={addSectionAction} className="flex gap-2">
          <input type="hidden" name="jurnalId" value={id} />
          <input name="name" required placeholder="Evening" className={input} /><button className={button}>Add</button>
        </form>
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold">Remind me</h2>
        <ul className="text-sm">
          {rules.map(({ rule }) => (
            <li key={rule.id} className="flex items-center gap-3">
              <span>
                {rule.sectionId ? allSections.find((s) => s.id === rule.sectionId)?.name : "Whole jurnal"}: log by{" "}
                {(rule.config as { deadline: string }).deadline}
              </span>
              <form action={deleteRuleAction}>
                <input type="hidden" name="ruleId" value={rule.id} /><input type="hidden" name="back" value={`/j/${id}/settings`} />
                <button className={linkButton}>Remove</button>
              </form>
            </li>
          ))}
          {rules.length === 0 && <li className="text-neutral-500">No reminders yet.</li>}
        </ul>
        <form action={createSelfRuleAction} className="flex flex-wrap items-end gap-3 text-sm">
          <input type="hidden" name="jurnalId" value={id} />
          <label>For<br /><select name="sectionId" className={input}><option value="">Whole jurnal</option>
            {allSections.filter((s) => !s.archivedAt).map((s) => <option key={s.id} value={s.id}>{s.isDefault ? "Entries" : s.name}</option>)}</select></label>
          <label>If nothing is logged by<br /><input type="time" name="deadline" defaultValue="10:00" className={input} /></label>
          <button className={button}>Add reminder</button>
        </form>
        <p className="text-xs text-neutral-500">Times use your account timezone. Turn on notifications under Settings.</p>
      </section>

      <form action={archiveJurnalAction}>
        <input type="hidden" name="jurnalId" value={id} />
        <button className="text-sm text-red-700 underline">Archive this jurnal</button>
      </form>
    </div>
  );
}

function presetOf(s: { count: number; period: string; weekdays?: number[]; times?: string[] } | null) {
  if (!s) return "";
  if (s.times) return s.times.join() === "08:00,12:30,18:30" ? "meal times" : "times";
  if (s.period === "week") return `weekly:${s.count}`;
  if (s.weekdays) return "weekdays";
  return "daily";
}
