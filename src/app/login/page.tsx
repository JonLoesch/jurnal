import { devLoginEnabled, googleEnabled } from "@/auth";
import { button, input } from "../_components";
import { devSignInAction, googleSignInAction } from "../actions";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 py-10">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {googleEnabled && (
        <form action={googleSignInAction}>
          <button className={`${button} w-full py-2`}>Continue with Google</button>
        </form>
      )}
      {devLoginEnabled && (
        <form action={devSignInAction} className="space-y-2 rounded border border-dashed border-neutral-400 p-3">
          <p className="text-xs text-neutral-500">Local development login (not available in production).</p>
          <input name="email" type="email" required placeholder="email" className={`${input} w-full`} />
          <input name="name" placeholder="name" className={`${input} w-full`} />
          <button className={button}>Sign in</button>
        </form>
      )}
      {!googleEnabled && !devLoginEnabled && <p className="text-sm">Sign-in isn&apos;t configured yet.</p>}
      <p className="text-xs text-neutral-500">
        Jurnal is not a place for private health information or messaging. Don&apos;t record anything you wouldn&apos;t want a
        person you share it with, or the person running this server, to see.
      </p>
    </div>
  );
}
