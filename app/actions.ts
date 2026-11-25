"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import fs from "node:fs/promises";
import { db } from "@/lib/db";
import {
  courseLinks, courses, customEvents, exams, files, folders, notes, revisionSessions,
  EVENT_KINDS, REVISION_LEVELS, SESSION_TYPES,
  type EventKind, type RevisionLevel, type SessionType,
} from "@/lib/db/schema";
import { syncCelcat } from "@/lib/sync";
import { ensureCourse, uniqueSlug, DEFAULT_FOLDERS } from "@/lib/courses";
import { getSmartSuggestion } from "@/lib/smart-link";
import { getSetting, setSetting } from "@/lib/settings";
import { parseCelcatUrl } from "@/lib/celcat";
import { colorFromString } from "@/lib/utils";
import { courseDir, storedFilePath } from "@/lib/storage";
import { dismissCelcatExam, importCelcatExams } from "@/lib/exam-import";

const refresh = () => revalidatePath("/", "layout");
const str = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: string | null | undefined) => !s || /^\d{2}:\d{2}$/.test(s);

/* ------------------------------- Celcat ------------------------------- */

export async function syncNow() {
  const status = await syncCelcat();
  refresh();
  return status;
}

export async function saveCelcatSettings(input: {
  baseUrl: string; resourceId: string; resourceType: number; resourceLabel?: string;
  /** undefined = inchangé, "" = effacer */
  cookie?: string; username?: string; password?: string;
}) {
  let baseUrl = str(input.baseUrl, 500);
  let resourceId = str(input.resourceId, 200);
  let resourceType = Number(input.resourceType) || 103;
  // Une URL Celcat complète copiée depuis le navigateur (…/cal?…&et=student&fid0=…) est décomposée
  const parsed = baseUrl ? parseCelcatUrl(baseUrl) : null;
  if (baseUrl && !parsed) throw new Error("URL Celcat invalide (elle doit commencer par https://)");
  if (parsed) {
    baseUrl = parsed.baseUrl;
    if (parsed.resourceId) resourceId = parsed.resourceId;
    if (parsed.resourceType) resourceType = parsed.resourceType;
  }
  const prev = getSetting<Record<string, string>>("celcat", {});
  setSetting("celcat", {
    baseUrl,
    resourceId,
    resourceType,
    resourceLabel: str(input.resourceLabel, 200),
    cookie: input.cookie === undefined ? prev.cookie ?? "" : str(input.cookie, 4000),
    username: input.username === undefined ? prev.username ?? "" : str(input.username, 200),
    password: input.password === undefined ? prev.password ?? "" : String(input.password).slice(0, 500),
  });
  const status = await syncCelcat();
  refresh();
  return status;
}

export async function saveExamImportSettings(input: { enabled: boolean; level: RevisionLevel; customPercent: number; restoreDismissed?: boolean }) {
  if (!REVISION_LEVELS.includes(input.level)) throw new Error("Niveau invalide");
  setSetting("exams.import", {
    enabled: !!input.enabled,
    level: input.level,
    customPercent: Math.min(100, Math.max(1, Math.round(input.customPercent || 25))),
  });
  if (input.restoreDismissed) setSetting("exams.dismissed", []);
  const r = importCelcatExams();
  refresh();
  return r;
}

export async function getSuggestion(courseId: number) {
  return getSmartSuggestion(courseId);
}

/* ------------------------------- Matières ------------------------------- */

export async function createCourse(name: string, color?: string) {
  const n = str(name, 120);
  if (!n) throw new Error("Nom requis");
  const { course } = ensureCourse(n, { source: "manual", color: color || colorFromString(n), slug: uniqueSlug(n) });
  refresh();
  return course.slug;
}

export async function updateCourse(id: number, data: { name?: string; color?: string; archived?: boolean }) {
  const patch: Partial<typeof courses.$inferInsert> = {};
  if (data.name !== undefined) patch.name = str(data.name, 120) || "Sans titre";
  if (data.color !== undefined && /^#[0-9a-f]{6}$/i.test(data.color)) patch.color = data.color;
  if (data.archived !== undefined) patch.archived = data.archived;
  db.update(courses).set(patch).where(eq(courses.id, id)).run();
  refresh();
}

export async function deleteCourse(id: number) {
  db.delete(courses).where(eq(courses.id, id)).run();
  await fs.rm(courseDir(id), { recursive: true, force: true });
  refresh();
}

export async function saveMemo(courseId: number, memo: string) {
  db.update(courses).set({ memo: String(memo ?? "").slice(0, 20000) }).where(eq(courses.id, courseId)).run();
  revalidatePath("/courses", "layout");
}

export async function addLink(courseId: number, label: string, url: string) {
  let u = str(url, 2000);
  if (u && !/^[a-z]+:\/\//i.test(u)) u = `https://${u}`;
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error("URL invalide");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Seuls les liens http(s) sont autorisés");
  const l = str(label, 100) || parsed.hostname.replace(/^www\./, "");
  db.insert(courseLinks).values({ courseId, label: l, url: parsed.toString(), position: Date.now() }).run();
  revalidatePath("/courses", "layout");
}

export async function deleteLink(id: number) {
  db.delete(courseLinks).where(eq(courseLinks.id, id)).run();
  revalidatePath("/courses", "layout");
}

/* ------------------------------- Dossiers / fichiers ------------------------------- */

export async function createFolder(courseId: number, parentId: number | null, name: string) {
  const n = str(name, 120);
  if (!n) throw new Error("Nom requis");
  db.insert(folders).values({ courseId, parentId, name: n }).run();
  revalidatePath("/courses", "layout");
}

export async function createDefaultFolders(courseId: number) {
  for (const f of DEFAULT_FOLDERS) db.insert(folders).values({ courseId, name: f }).run();
  revalidatePath("/courses", "layout");
}

export async function renameFolder(id: number, name: string) {
  const n = str(name, 120);
  if (n) db.update(folders).set({ name: n }).where(eq(folders.id, id)).run();
  revalidatePath("/courses", "layout");
}

function descendantFolderIds(rootId: number): number[] {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) {
    const children = db.select({ id: folders.id }).from(folders).where(eq(folders.parentId, ids[i])).all();
    ids.push(...children.map((c) => c.id));
  }
  return ids;
}

export async function deleteFolder(id: number) {
  const ids = descendantFolderIds(id);
  const rows = db.select().from(files).where(inArray(files.folderId, ids)).all();
  db.delete(folders).where(eq(folders.id, id)).run(); // cascade : sous-dossiers, fichiers, notes
  await Promise.all(rows.map((f) => fs.rm(storedFilePath(f.courseId, f.storedName), { force: true })));
  revalidatePath("/courses", "layout");
}

export async function moveFolder(id: number, parentId: number | null) {
  if (parentId !== null && descendantFolderIds(id).includes(parentId)) throw new Error("Déplacement impossible");
  db.update(folders).set({ parentId }).where(eq(folders.id, id)).run();
  revalidatePath("/courses", "layout");
}

export async function renameFile(id: number, name: string) {
  const n = str(name, 200);
  if (n) db.update(files).set({ name: n }).where(eq(files.id, id)).run();
  revalidatePath("/courses", "layout");
}

export async function moveFile(id: number, folderId: number | null) {
  db.update(files).set({ folderId }).where(eq(files.id, id)).run();
  revalidatePath("/courses", "layout");
}

export async function deleteFile(id: number) {
  const f = db.select().from(files).where(eq(files.id, id)).get();
  if (!f) return;
  db.delete(files).where(eq(files.id, id)).run();
  await fs.rm(storedFilePath(f.courseId, f.storedName), { force: true });
  revalidatePath("/courses", "layout");
}

/* ------------------------------- Notes ------------------------------- */

export async function createNote(courseId: number, folderId: number | null, title?: string) {
  const note = db
    .insert(notes)
    .values({ courseId, folderId, title: str(title, 200) || "Nouvelle note", content: "" })
    .returning()
    .get();
  revalidatePath("/courses", "layout");
  return note.id;
}

export async function saveNote(id: number, data: { title?: string; content?: string; folderId?: number | null }) {
  const patch: Partial<typeof notes.$inferInsert> = { updatedAt: new Date() };
  if (data.title !== undefined) patch.title = str(data.title, 200) || "Sans titre";
  if (data.content !== undefined) patch.content = String(data.content).slice(0, 500_000);
  if (data.folderId !== undefined) patch.folderId = data.folderId;
  db.update(notes).set(patch).where(eq(notes.id, id)).run();
  revalidatePath("/courses", "layout");
}

export async function deleteNote(id: number) {
  db.delete(notes).where(eq(notes.id, id)).run();
  revalidatePath("/courses", "layout");
}

/* ------------------------------- Partiels & révisions ------------------------------- */

export interface SessionInput {
  id?: number;
  date: string;
  startTime: string | null;
  durationMinutes: number;
  title: string;
  description: string;
  done?: boolean;
}

export interface ExamInput {
  courseId: number;
  title: string;
  startsAt: number;
  durationMinutes: number;
  location: string;
  revisionLevel: RevisionLevel;
  revisionPercent: number;
  notes?: string;
  sessions: SessionInput[];
}

function validateExam(input: ExamInput) {
  if (!input.courseId) throw new Error("Matière requise");
  if (!Number.isFinite(input.startsAt)) throw new Error("Date invalide");
  if (!REVISION_LEVELS.includes(input.revisionLevel)) throw new Error("Niveau invalide");
  for (const s of input.sessions) {
    if (!isDate(s.date) || !isTime(s.startTime)) throw new Error("Session invalide");
  }
}

function insertSessions(examId: number, courseId: number, sessions: SessionInput[]) {
  for (const s of sessions) {
    db.insert(revisionSessions)
      .values({
        examId,
        courseId,
        date: s.date,
        startTime: s.startTime || null,
        durationMinutes: Math.min(600, Math.max(10, Math.round(s.durationMinutes || 90))),
        title: str(s.title, 200) || "Révision",
        description: str(s.description, 4000),
        done: !!s.done,
        doneAt: s.done ? new Date() : null,
      })
      .run();
  }
}

export async function createExam(input: ExamInput) {
  validateExam(input);
  const id = db.transaction(() => {
    const exam = db
      .insert(exams)
      .values({
        courseId: input.courseId,
        title: str(input.title, 200) || "Partiel",
        startsAt: new Date(input.startsAt),
        durationMinutes: Math.max(15, Math.round(input.durationMinutes || 120)),
        location: str(input.location, 200),
        revisionLevel: input.revisionLevel,
        revisionPercent: Math.min(100, Math.max(0, Math.round(input.revisionPercent))),
        notes: str(input.notes, 4000),
      })
      .returning()
      .get();
    insertSessions(exam.id, input.courseId, input.sessions);
    return exam.id;
  });
  refresh();
  return id;
}

export async function updateExam(id: number, input: ExamInput) {
  validateExam(input);
  db.transaction(() => {
    db.update(exams)
      .set({
        courseId: input.courseId,
        title: str(input.title, 200) || "Partiel",
        startsAt: new Date(input.startsAt),
        durationMinutes: Math.max(15, Math.round(input.durationMinutes || 120)),
        location: str(input.location, 200),
        revisionLevel: input.revisionLevel,
        revisionPercent: Math.min(100, Math.max(0, Math.round(input.revisionPercent))),
        notes: str(input.notes, 4000),
      })
      .where(eq(exams.id, id))
      .run();
    db.delete(revisionSessions).where(eq(revisionSessions.examId, id)).run();
    insertSessions(id, input.courseId, input.sessions);
  });
  refresh();
}

export async function deleteExam(id: number) {
  const exam = db.select({ celcatEventId: exams.celcatEventId }).from(exams).where(eq(exams.id, id)).get();
  if (exam?.celcatEventId) dismissCelcatExam(exam.celcatEventId);
  db.delete(exams).where(eq(exams.id, id)).run();
  refresh();
}

export async function toggleSession(id: number, done: boolean) {
  db.update(revisionSessions).set({ done, doneAt: done ? new Date() : null }).where(eq(revisionSessions.id, id)).run();
  refresh();
}

export async function updateSession(id: number, data: Partial<SessionInput>) {
  const patch: Partial<typeof revisionSessions.$inferInsert> = {};
  if (data.date !== undefined && isDate(data.date)) patch.date = data.date;
  if (data.startTime !== undefined && isTime(data.startTime)) patch.startTime = data.startTime || null;
  if (data.title !== undefined) patch.title = str(data.title, 200) || "Révision";
  if (data.description !== undefined) patch.description = str(data.description, 4000);
  if (data.durationMinutes !== undefined) patch.durationMinutes = Math.max(10, Math.round(data.durationMinutes));
  db.update(revisionSessions).set(patch).where(eq(revisionSessions.id, id)).run();
  refresh();
}

export async function deleteSession(id: number) {
  db.delete(revisionSessions).where(eq(revisionSessions.id, id)).run();
  refresh();
}

/* ------------------------------- Événements personnalisés ------------------------------- */

export interface EventInput {
  courseId: number | null;
  kind: EventKind;
  title: string;
  description: string;
  startsAt: number;
  endsAt?: number | null;
  allDay: boolean;
  linkedCelcatEventId?: string | null;
  linkedSessionType?: SessionType | null;
}

function eventValues(input: EventInput) {
  if (!EVENT_KINDS.includes(input.kind)) throw new Error("Type invalide");
  if (!Number.isFinite(input.startsAt)) throw new Error("Date invalide");
  return {
    courseId: input.courseId || null,
    kind: input.kind,
    title: str(input.title, 200) || "Événement",
    description: str(input.description, 4000),
    startsAt: new Date(input.startsAt),
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    allDay: !!input.allDay,
    linkedCelcatEventId: input.linkedCelcatEventId || null,
    linkedSessionType:
      input.linkedSessionType && SESSION_TYPES.includes(input.linkedSessionType) ? input.linkedSessionType : null,
  };
}

export async function createEvent(input: EventInput) {
  const row = db.insert(customEvents).values(eventValues(input)).returning().get();
  refresh();
  return row.id;
}

export async function updateEvent(id: number, input: EventInput) {
  db.update(customEvents).set(eventValues(input)).where(eq(customEvents.id, id)).run();
  refresh();
}

export async function toggleEvent(id: number, done: boolean) {
  db.update(customEvents).set({ done }).where(eq(customEvents.id, id)).run();
  refresh();
}

export async function deleteEvent(id: number) {
  db.delete(customEvents).where(eq(customEvents.id, id)).run();
  refresh();
}
