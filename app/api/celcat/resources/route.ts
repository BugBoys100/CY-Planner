import { NextResponse } from "next/server";
import { parseCelcatUrl, searchResources } from "@/lib/celcat";
import { MOCK_RESOURCES } from "@/lib/celcat-mock";
import { getCelcatSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const type = Number(sp.get("type") ?? 103) || 103;
  const cfg = getCelcatSettings();
  const typed = sp.get("baseUrl") ? parseCelcatUrl(sp.get("baseUrl")!) : null;
  const baseUrl = typed?.baseUrl ?? cfg.baseUrl;
  if (q.length < 2) return NextResponse.json([]);
  if (!baseUrl) {
    return NextResponse.json(MOCK_RESOURCES.filter((r) => r.text.toLowerCase().includes(q.toLowerCase())));
  }
  try {
    return NextResponse.json(await searchResources({ ...cfg, baseUrl }, q, type));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
