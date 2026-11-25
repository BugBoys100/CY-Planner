import { NextResponse } from "next/server";
import { runDailyReminders } from "@/lib/notifications";
import { cronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** À appeler tous les jours à 17h30 (30 17 * * *) si le planificateur interne est désactivé. */
async function handler(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const force = new URL(req.url).searchParams.has("force");
  try {
    return NextResponse.json(await runDailyReminders({ force }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export { handler as GET, handler as POST };
