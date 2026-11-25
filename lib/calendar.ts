import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "./db";
import { celcatEvents, courses, customEvents, exams, revisionSessions, type EventKind, type SessionType } from "./db/schema";
import { dayKey, fromDayKey } from "./utils";

export type CalendarKind = "course" | "revision" | "exam" | "event";

export interface CalendarItem {
  id: string;
  refId: string | number;
  kind: CalendarKind;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  courseId: number | null;
  courseName: string | null;
  courseSlug: string | null;
  color: string;
  sessionType?: SessionType;
  category?: string;
  room?: string;
  teacher?: string;
  examId?: number;
  examTitle?: string;
  done?: boolean;
  cancelled?: boolean;
  eventKind?: EventKind;
  description?: string;
}

export function getCalendarItems(from: Date, to: Date): CalendarItem[] {
  const items: CalendarItem[] = [];

  const cel = db
    .select({ e: celcatEvents, c: courses })
    .from(celcatEvents)
    .leftJoin(courses, eq(courses.id, celcatEvents.courseId))
    .where(and(gte(celcatEvents.start, from), lt(celcatEvents.start, to)))
    .orderBy(asc(celcatEvents.start))
    .all();
  // Épreuves Celcat déjà représentées par un partiel importé : pas de doublon
  const linked = new Set(
    db.select({ id: exams.celcatEventId }).from(exams).where(and(gte(exams.startsAt, from), lt(exams.startsAt, to))).all().map((r) => r.id),
  );
  for (const { e, c } of cel) {
    if (linked.has(e.id)) continue;
    items.push({
      id: `c:${e.id}`, refId: e.id, kind: "course",
      title: e.subject, start: e.start.getTime(), end: e.end.getTime(), allDay: e.allDay,
      courseId: c?.id ?? null, courseName: c?.name ?? e.subject, courseSlug: c?.slug ?? null,
      color: c?.color ?? "#64748b", sessionType: e.sessionType, category: e.category,
      room: e.room, teacher: e.teacher, cancelled: e.cancelled,
    });
  }

  const rev = db
    .select({ s: revisionSessions, c: courses, x: exams })
    .from(revisionSessions)
    .innerJoin(courses, eq(courses.id, revisionSessions.courseId))
    .innerJoin(exams, eq(exams.id, revisionSessions.examId))
    .where(and(gte(revisionSessions.date, dayKey(from)), lt(revisionSessions.date, dayKey(to))))
    .all();
  for (const { s, c, x } of rev) {
    const start = fromDayKey(s.date, s.startTime ?? "18:00");
    items.push({
      id: `r:${s.id}`, refId: s.id, kind: "revision", title: s.title,
      start: start.getTime(), end: start.getTime() + s.durationMinutes * 60_000, allDay: !s.startTime,
      courseId: c.id, courseName: c.name, courseSlug: c.slug, color: c.color,
      examId: x.id, examTitle: x.title, done: s.done, description: s.description,
    });
  }

  const ex = db
    .select({ x: exams, c: courses })
    .from(exams)
    .innerJoin(courses, eq(courses.id, exams.courseId))
    .where(and(gte(exams.startsAt, from), lt(exams.startsAt, to)))
    .all();
  for (const { x, c } of ex) {
    items.push({
      id: `x:${x.id}`, refId: x.id, kind: "exam", title: x.title,
      start: x.startsAt.getTime(), end: x.startsAt.getTime() + x.durationMinutes * 60_000, allDay: false,
      courseId: c.id, courseName: c.name, courseSlug: c.slug, color: c.color,
      examId: x.id, room: x.location,
    });
  }

  const ev = db
    .select({ e: customEvents, c: courses })
    .from(customEvents)
    .leftJoin(courses, eq(courses.id, customEvents.courseId))
    .where(and(gte(customEvents.startsAt, from), lt(customEvents.startsAt, to)))
    .all();
  for (const { e, c } of ev) {
    const start = e.startsAt.getTime();
    items.push({
      id: `e:${e.id}`, refId: e.id, kind: "event", title: e.title,
      start, end: e.endsAt?.getTime() ?? start + 30 * 60_000, allDay: e.allDay,
      courseId: c?.id ?? null, courseName: c?.name ?? null, courseSlug: c?.slug ?? null,
      color: c?.color ?? "#64748b", done: e.done, eventKind: e.kind, description: e.description,
      sessionType: e.linkedSessionType ?? undefined,
    });
  }

  return items.sort((a, b) => a.start - b.start);
}
