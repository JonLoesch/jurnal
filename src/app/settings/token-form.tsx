"use client";

import { useActionState } from "react";
import { button, input } from "../_components";
import { createTokenAction, type TokenFormState } from "../actions";

const SCOPES = [
  { value: "entries", label: "Make and edit entries" },
  { value: "settings", label: "Edit jurnals, sections and metrics" },
];

/** Makes a token and shows it once, with the command that connects Claude Code to it. */
export function TokenForm({ defaultDays }: { defaultDays: number }) {
  const [state, action, pending] = useActionState<TokenFormState, FormData>(createTokenAction, {});
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-3 text-sm">
        <label>Name<br /><input name="name" required placeholder="Claude Code on my laptop" className={`${input} w-56`} /></label>
        <label>Expires in (days)<br /><input type="number" name="days" min="1" max="1095" defaultValue={defaultDays} className={`${input} w-24`} /></label>
        <fieldset className="flex flex-col gap-1">
          <label className="flex items-center gap-1 text-neutral-500"><input type="checkbox" checked disabled readOnly /> Read jurnals and entries</label>
          {SCOPES.map((s) => (
            <label key={s.value} className="flex items-center gap-1"><input type="checkbox" name="scopes" value={s.value} /> {s.label}</label>
          ))}
        </fieldset>
        <button className={button} disabled={pending}>Create token</button>
      </form>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.token && (
        <div className="space-y-2 rounded border border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950">
          <p className="font-medium">Copy this now. It won&apos;t be shown again.</p>
          <code className="block break-all">{state.token}</code>
          <p>Connect Claude Code:</p>
          <code className="block break-all">
            claude mcp add --transport http jurnal {origin}/api/mcp --header &quot;Authorization: Bearer {state.token}&quot;
          </code>
        </div>
      )}
    </div>
  );
}
