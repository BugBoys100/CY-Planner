import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { celcatEvents, courses, customEvents, exams, revisionSessions, type Course } from "./db/schema";
import { addDaysKey, dayKey, fromDayKey } from "./utils";

export function getCourseOptions() {
  return db
    .select({ id: courses.id, name: courses.name, color: courses.color, slug: courses.slug })
    .from(courses)
    .where(eq(courses.archived, false))
    .orderBy(asc(courses.name))
    .all();
}

export function getSessionsForDay(key: string) {
  return db
    .select({ s: revisionSessions, c: courses, examTitle: exams.title, examAt: exams.startsAt })
    .from(revisionSessions)
    .innerJoin(courses, eq(courses.id, revisionSessions.courseId))
    .innerJoin(exams, eq(exams.id, revisionSessions.examId))
    .where(eq(revisionSessions.date, key))
    .orderBy(asc(revisionSessions.startTime))
    .all();
}

export function getUpcomingEvents(days = 7, now = new Date()) {
  const from = fromDayKey(dayKey(now));
  const to = fromDayKey(addDaysKey(dayKey(now), days + 1));
  return db
    .select({ e: customEvents, c: courses })
    .from(customEvents)
    .leftJoin(courses, eq(courses.id, customEvents.courseId))
    .where(and(gte(customEvents.startsAt, from), lt(customEvents.startsAt, to)))
    .orderBy(asc(customEvents.done), asc(customEvents.startsAt))
    .all();
}

export function getOverdueEvents(now = new Date()) {
  return db
    .select({ e: customEvents, c: courses })
    .from(customEvents)
    .leftJoin(courses, eq(courses.id, customEvents.courseId))
    .where(and(lt(customEvents.startsAt, fromDayKey(dayKey(now))), eq(customEvents.done, false)))
    .orderBy(asc(customEvents.startsAt))
    .limit(10)
    .all();
}

export function getCelcatDay(key: string) {
  return db
    .select({ e: celcatEvents, c: courses })
    .from(celcatEvents)
    .leftJoin(courses, eq(courses.id, celcatEvents.courseId))
    .where(and(gte(celcatEvents.start, fromDayKey(key)), lt(celcatEvents.start, fromDayKey(addDaysKey(key, 1)))))
    .orderBy(asc(celcatEvents.start))
    .all();
}

/** Prochain jour (à partir de demain) qui contient des cours */
export function getNextCourseDay(now = new Date()) {
  const row = db
    .select({ start: celcatEvents.start })
    .from(celcatEvents)
    .where(and(gte(celcatEvents.start, fromDayKey(addDaysKey(dayKey(now), 1))), eq(celcatEvents.cancelled, false)))
    .orderBy(asc(celcatEvents.start))
    .limit(1)
    .get();
  return row ? dayKey(row.start) : null;
}

export interface ExamWithProgress {
  exam: typeof exams.$inferSelect;
  course: Course;
  total: number;
  done: number;
  nextSession: string | null;
}

export function getExams({ upcomingOnly = false } = {}): ExamWithProgress[] {
  const now = new Date();
  const rows = db
    .select({
      exam: exams,
      course: courses,
      total: sql<number>`(select count(*) from revision_sessions rs where rs.exam_id = ${exams.id})`,
      done: sql<number>`(select count(*) from revision_sessions rs where rs.exam_id = ${exams.id} and rs.done = 1)`,
      nextSession: sql<string | null>`(select min(rs.date) from revision_sessions rs where rs.exam_id = ${exams.id} and rs.done = 0 and rs.date >= ${dayKey(now)})`,
    })
    .from(exams)
    .innerJoin(courses, eq(courses.id, exams.courseId))
    .where(upcomingOnly ? gte(exams.startsAt, new Date(now.getTime() - 3 * 3600_000)) : undefined)
    .orderBy(asc(exams.startsAt))
    .all();
  return rows;
}

export function getExamSessions(examId: number) {
  return db
    .select()
    .from(revisionSessions)
    .where(eq(revisionSessions.examId, examId))
    .orderBy(asc(revisionSessions.date), asc(revisionSessions.startTime))
    .all();
}
