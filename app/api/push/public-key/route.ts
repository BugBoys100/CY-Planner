import { NextResponse } from "next/server";
import { pushConfigured, vapidPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ configured: pushConfigured(), publicKey: vapidPublicKey() });
}
