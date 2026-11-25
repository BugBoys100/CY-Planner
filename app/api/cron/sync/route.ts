import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncCelcat } from "@/lib/sync";
import { cronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const status = await syncCelcat();
  revalidatePath("/", "layout");
  return NextResponse.json(status);
}

export { handler as GET, handler as POST };
