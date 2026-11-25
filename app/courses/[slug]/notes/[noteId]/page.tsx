import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses, folders, notes } from "@/lib/db/schema";
import { NoteEditor } from "@/components/courses/note-editor";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  const n = db.select({ title: notes.title }).from(notes).where(eq(notes.id, Number(noteId))).get();
  return { title: n?.title ?? "Note" };
}

export default async function NotePage({ params }: { params: Promise<{ slug: string; noteId: string }> }) {
  const { slug, noteId } = await params;
  const course = db.select().from(courses).where(eq(courses.slug, slug)).get();
  if (!course) notFound();
  const note = db.select().from(notes).where(and(eq(notes.id, Number(noteId)), eq(notes.courseId, course.id))).get();
  if (!note) notFound();
  const folderRows = db.select({ id: folders.id, name: folders.name, parentId: folders.parentId }).from(folders)
    .where(eq(folders.courseId, course.id)).orderBy(asc(folders.name)).all();
  return (
    <NoteEditor
      course={{ id: course.id, slug: course.slug, name: course.name, color: course.color }}
      note={{ id: note.id, title: note.title, content: note.content, folderId: note.folderId, updatedAt: note.updatedAt.getTime() }}
      folders={folderRows}
    />
  );
}
