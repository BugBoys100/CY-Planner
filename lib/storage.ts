import path from "node:path";

export const UPLOADS_ROOT = path.resolve(process.cwd(), process.env.UPLOADS_DIR ?? "./uploads");
export const MAX_UPLOAD_BYTES = (Number(process.env.MAX_UPLOAD_MB) || 100) * 1024 * 1024;

export function courseDir(courseId: number) {
  return path.join(UPLOADS_ROOT, String(Math.trunc(courseId)));
}

/** Chemin absolu d'un fichier stocké, garanti à l'intérieur du dossier uploads (anti path-traversal). */
export function storedFilePath(courseId: number, storedName: string) {
  const p = path.resolve(courseDir(courseId), path.basename(storedName));
  if (!p.startsWith(UPLOADS_ROOT + path.sep)) throw new Error("Chemin invalide");
  return p;
}

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", txt: "text/plain", md: "text/markdown", csv: "text/csv",
  json: "application/json", zip: "application/zip", ipynb: "application/x-ipynb+json",
  py: "text/x-python", c: "text/x-c", h: "text/x-c", cpp: "text/x-c++", java: "text/x-java", js: "text/javascript",
  ts: "text/plain", html: "text/html", sql: "text/plain", tex: "text/x-tex",
};

export function guessMime(name: string, provided?: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? (provided || "application/octet-stream");
}

/** Types affichables inline sans risque (pas de HTML / SVG exécutable sur l'origine de l'app). */
export function isSafeInline(mime: string) {
  return mime === "application/pdf" || /^image\/(png|jpe?g|gif|webp|avif)$/.test(mime) || mime.startsWith("text/") && mime !== "text/html";
}

export type PreviewKind = "pdf" | "image" | "text" | "none";
export function previewKind(mime: string, name: string): PreviewKind {
  if (mime === "application/pdf") return "pdf";
  if (/^image\/(png|jpe?g|gif|webp|avif)$/.test(mime)) return "image";
  if ((mime.startsWith("text/") && mime !== "text/html") || /\.(md|txt|py|c|h|cpp|java|js|ts|sql|json|csv|tex|ipynb)$/i.test(name)) return "text";
  return "none";
}
