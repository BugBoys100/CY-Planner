import { NextResponse } from "next/server";
import { getCalendarItems } from "@/lib/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const from = new Date(Number(sp.get("from")));
  const to = new Date(Number(sp.get("to")));
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 120 * 86400_000) {
    return NextResponse.json({ error: "Plage invalide" }, { status: 400 });
  }
  return NextResponse.json(getCalendarItems(from, to));
}
