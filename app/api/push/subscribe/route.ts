import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";

export const runtime = "nodejs";

interface SubBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(req: Request) {
  const body = (await req.json()) as SubBody;
  if (!body.endpoint || !/^https:\/\//.test(body.endpoint) || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });
  }
  const values = {
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    userAgent: (req.headers.get("user-agent") ?? "").slice(0, 300),
  };
  db.insert(pushSubscriptions)
    .values(values)
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh: values.p256dh, auth: values.auth } })
    .run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { endpoint } = (await req.json()) as SubBody;
  if (endpoint) db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
  return NextResponse.json({ ok: true });
}
