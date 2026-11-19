import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getDb } from "@/db/client";
import { currentAccountId } from "@/server/session";
import { getOverdue } from "@/server/alerts";
import { dismissAction, signOutAction, snoozeAction } from "./actions";
import { RegisterServiceWorker } from "./register-sw";
import { button, linkButton } from "./_components";

export const metadata: Metadata = {
  title: "Jurnal",
  description: "Record what matters, and get reminded to.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#2563eb" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const accountId = await currentAccountId();
  const overdue = accountId ? await getOverdue(getDb(), accountId) : [];
  return (
    <html lang="en">
      <body className="mx-auto max-w-3xl px-4 pb-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="flex items-center justify-between py-4">
          <Link href="/" className="text-lg font-semibold">Jurnal</Link>
          <nav className="flex items-center gap-4">
            {accountId ? (
              <>
                <Link href="/settings" className={linkButton}>Settings</Link>
                <form action={signOutAction}><button className={linkButton}>Sign out</button></form>
              </>
            ) : (
              <Link href="/login" className={linkButton}>Sign in</Link>
            )}
          </nav>
        </header>
        {overdue.map((o) => (
          <div key={o.firingId} role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <span><Link href={`/j/${o.jurnalId}?from=alert&firing=${o.firingId}`} className="font-medium underline">{o.jurnalName}</Link>: {o.message}</span>
            <span className="flex gap-2">
              <form action={snoozeAction} className="flex gap-1">
                <input type="hidden" name="firingId" value={o.firingId} />
                <select name="hours" className="rounded border border-amber-400 bg-transparent px-1 text-xs" defaultValue="1">
                  <option value="1">1 hour</option><option value="3">3 hours</option><option value="24">Tomorrow</option>
                </select>
                <button className={button}>Snooze</button>
              </form>
              <form action={dismissAction}><input type="hidden" name="firingId" value={o.firingId} /><button className={linkButton}>Dismiss</button></form>
            </span>
          </div>
        ))}
        <main>{children}</main>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
