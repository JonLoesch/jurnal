import { eq } from "drizzle-orm";
import webpush from "web-push";
import type { Db } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";

export type NotificationPayload = { title: string; body: string; url: string };

/** A way of reaching a person. Web push now; email, SMS, Slack and others can implement this later. */
export interface Notifier {
  send(accountId: string, payload: NotificationPayload): Promise<void>;
}

export class RecordingNotifier implements Notifier {
  sent: { accountId: string; payload: NotificationPayload }[] = [];
  async send(accountId: string, payload: NotificationPayload) {
    this.sent.push({ accountId, payload });
  }
}

export class WebPushNotifier implements Notifier {
  constructor(
    private db: Db,
    vapid: { publicKey: string; privateKey: string; subject: string },
  ) {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  }

  async send(accountId: string, payload: NotificationPayload) {
    const subs = await this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.accountId, accountId));
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
          );
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // 404/410: the browser dropped this subscription. Forget it.
          if (status === 404 || status === 410) await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
          else console.error("push failed", status);
        }
      }),
    );
  }
}

/** The notifier for this deployment: web push if VAPID keys are configured, otherwise a console logger. */
export function defaultNotifier(db: Db): Notifier {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey)
    return new WebPushNotifier(db, { publicKey, privateKey, subject: process.env.VAPID_SUBJECT ?? "mailto:admin@example.com" });
  return {
    async send(accountId, payload) {
      console.log(`[notify:dev] ${accountId}: ${payload.title} - ${payload.body}`);
    },
  };
}
