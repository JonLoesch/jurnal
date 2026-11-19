"use client";

import { useEffect, useState } from "react";
import { button } from "./_components";
import { updateAccountAction } from "./actions";

/** New accounts start in UTC. If the browser knows better, offer to switch. */
export function TimezoneNudge({ current, name, weekStart }: { current: string; name: string; weekStart: number }) {
  const [detected, setDetected] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(Intl.DateTimeFormat().resolvedOptions().timeZone).then((tz) => {
      if (!cancelled && tz && tz !== current) setDetected(tz);
    });
    return () => {
      cancelled = true;
    };
  }, [current]);
  if (!detected) return null;
  return (
    <form action={updateAccountAction} className="mb-4 flex flex-wrap items-center gap-3 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
      <span>Your timezone is set to {current}, but this device says {detected}. &quot;Today&quot; and reminder times follow it.</span>
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="weekStart" value={weekStart} />
      <input type="hidden" name="timezone" value={detected} />
      <button className={button}>Use {detected}</button>
    </form>
  );
}
