/** Vérifie le secret des endpoints /api/cron/* (Authorization: Bearer <CRON_SECRET> ou ?key=) */
export function cronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "change-me") return false;
  const header = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  return header === `Bearer ${secret}` || key === secret;
}
