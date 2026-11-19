"use client";

import { useEffect, useState } from "react";
import { button } from "../_components";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<"unknown" | "unsupported" | "off" | "on" | "blocked">("unknown");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const set = (v: typeof state) => {
      if (!cancelled) setState(v);
    };
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !publicKey) return set("unsupported");
      if (Notification.permission === "denied") return set("blocked");
      const reg = await navigator.serviceWorker.ready;
      set((await reg.pushManager.getSubscription()) ? "on" : "off");
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function enable() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("blocked");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }),
      });
      if (!res.ok) throw new Error("save failed");
      setState("on");
      setMessage("Notifications are on for this device.");
    } catch {
      setMessage("Couldn't turn on notifications. Try again.");
    }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    await sub?.unsubscribe();
    setState("off");
  }

  if (state === "unknown") return <p className="text-sm text-neutral-500">Checking...</p>;
  if (state === "unsupported")
    return <p className="text-sm text-neutral-500">Push notifications aren&apos;t available here. On Android, install Jurnal to your home screen from the browser menu, or ask the person running this server to configure push keys.</p>;
  if (state === "blocked") return <p className="text-sm">Notifications are blocked for this site. Allow them in your browser&apos;s site settings.</p>;
  return (
    <div className="space-y-2 text-sm">
      <p>{state === "on" ? "Notifications are on for this device." : "Notifications are off for this device."}</p>
      {state === "on" ? <button onClick={disable} className={button}>Turn off</button> : <button onClick={enable} className={button}>Turn on</button>}
      {message && <p className="text-neutral-500">{message}</p>}
    </div>
  );
}
