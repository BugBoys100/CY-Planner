import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncCelcat } from "@/lib/sync";

export const runtime = "nodejs";

export async function POST() {
  const status = await syncCelcat();
  revalidatePath("/", "layout");
  return NextResponse.json(status, { status: status.ok ? 200 : 502 });
}
