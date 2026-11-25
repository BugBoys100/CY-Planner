import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { courses, files, folders } from "@/lib/db/schema";
import { courseDir, guessMime, MAX_UPLOAD_BYTES } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const courseId = Number(form.get("courseId"));
  const folderRaw = form.get("folderId");
  const folderId = folderRaw && folderRaw !== "null" && folderRaw !== "" ? Number(folderRaw) : null;

  const course = db.select().from(courses).where(eq(courses.id, courseId)).get();
  if (!course) return NextResponse.json({ error: "Matière introuvable" }, { status: 404 });
  if (folderId !== null) {
    const f = db.select().from(folders).where(and(eq(folders.id, folderId), eq(folders.courseId, courseId))).get();
    if (!f) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
  }

  const uploads = form.getAll("files").filter((f): f is File => typeof f !== "string");
  if (!uploads.length) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });

  const dir = courseDir(courseId);
  await fs.mkdir(dir, { recursive: true });
  const created = [];
  for (const file of uploads) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `${file.name} dépasse la taille maximale` }, { status: 413 });
    }
    const name = path.basename(file.name || "fichier").slice(0, 200);
    const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 12);
    const storedName = `${crypto.randomUUID()}${ext}`;
    await fs.writeFile(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));
    const row = db
      .insert(files)
      .values({ courseId, folderId, name, storedName, mimeType: guessMime(name, file.type), size: file.size })
      .returning()
      .get();
    created.push(row);
  }
  revalidatePath(`/courses/${course.slug}`);
  return NextResponse.json({ files: created });
}
