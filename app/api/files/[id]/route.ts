import { eq } from "drizzle-orm";
import fs from "node:fs";
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { isSafeInline, storedFilePath } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = db.select().from(files).where(eq(files.id, Number(id))).get();
  if (!row) return new Response("Introuvable", { status: 404 });

  let filePath: string;
  try {
    filePath = storedFilePath(row.courseId, row.storedName);
  } catch {
    return new Response("Chemin invalide", { status: 400 });
  }
  if (!fs.existsSync(filePath)) return new Response("Fichier manquant sur le disque", { status: 410 });

  const download = new URL(req.url).searchParams.has("download");
  const inline = !download && isSafeInline(row.mimeType);
  // Les types non sûrs (HTML, SVG…) ne sont jamais rendus sur l'origine de l'app
  const contentType = inline ? row.mimeType : "application/octet-stream";
  const encoded = encodeURIComponent(row.name);
  const stat = fs.statSync(filePath);
  const stream = Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream;

  return new Response(stream, {
    headers: {
      "Content-Type": contentType.startsWith("text/") ? `${contentType}; charset=utf-8` : contentType,
      "Content-Length": String(stat.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      // Chrome refuse d'afficher un PDF dans un contexte "sandbox" : CSP stricte pour les autres types seulement
      ...(row.mimeType === "application/pdf" && inline
        ? {}
        : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
