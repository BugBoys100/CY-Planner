import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { pushSubscriptions } from "./db/schema";

let configured: boolean | null = null;

export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

export function pushConfigured() {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  return (configured = true);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPushToAll(payload: PushPayload) {
  if (!pushConfigured()) throw new Error("Clés VAPID absentes : lancez `npm run vapid` puis redémarrez.");
  const subs = db.select().from(pushSubscriptions).all();
  let sent = 0;
  let removed = 0;
  const errors: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 6 * 3600, urgency: "normal", topic: payload.tag?.slice(0, 32) },
        );
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id)).run();
          removed++;
        } else {
          errors.push(`${code ?? "?"} ${(e as Error).message}`);
        }
      }
    }),
  );
  return { subscriptions: subs.length, sent, removed, errors };
}
