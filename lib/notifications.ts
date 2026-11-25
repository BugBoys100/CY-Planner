import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "./db";
import { courses, customEvents, exams, revisionSessions } from "./db/schema";
import { sendPushToAll, type PushPayload } from "./push";
import { getSetting, setSetting } from "./settings";
import { addDaysKey, dayKey, fromDayKey } from "./utils";
import { fmtTime } from "./format";

export function buildDailyReminders(now = new Date()): PushPayload[] {
  const today = dayKey(now);
  const tomorrow = addDaysKey(today, 1);
  const tStart = fromDayKey(tomorrow);
  const tEnd = fromDayKey(addDaysKey(tomorrow, 1));
  const payloads: PushPayload[] = [];

  // 1. Révisions du jour non cochées
  const sessions = db
    .select({ title: revisionSessions.title, course: courses.name, time: revisionSessions.startTime })
    .from(revisionSessions)
    .innerJoin(courses, eq(courses.id, revisionSessions.courseId))
    .where(and(eq(revisionSessions.date, today), eq(revisionSessions.done, false)))
    .orderBy(asc(revisionSessions.startTime))
    .all();
  if (sessions.length) {
    const subjects = [...new Set(sessions.map((s) => s.course))];
    payloads.push({
      title: `📚 Ce soir : ${sessions.length} révision${sessions.length > 1 ? "s" : ""}`,
      body:
        `À réviser : ${subjects.join(", ")}.\n` +
        sessions.slice(0, 4).map((s) => `• ${s.course} — ${s.title}`).join("\n"),
      url: "/",
      tag: `revisions-${today}`,
    });
  }

  // 2. Devoirs / événements de demain
  const events = db
    .select({ title: customEvents.title, kind: customEvents.kind, startsAt: customEvents.startsAt, allDay: customEvents.allDay, course: courses.name })
    .from(customEvents)
    .leftJoin(courses, eq(courses.id, customEvents.courseId))
    .where(and(gte(customEvents.startsAt, tStart), lt(customEvents.startsAt, tEnd), eq(customEvents.done, false)))
    .orderBy(asc(customEvents.startsAt))
    .all();
  if (events.length) {
    payloads.push({
      title: `⏰ Demain : ${events.length} échéance${events.length > 1 ? "s" : ""}`,
      body: events
        .slice(0, 5)
        .map((e) => `• ${e.title}${e.course ? ` (${e.course})` : ""}${e.allDay ? "" : ` à ${fmtTime(e.startsAt)}`}`)
        .join("\n"),
      url: "/calendar",
      tag: `events-${tomorrow}`,
    });
  }

  // 3. Bonus : partiel demain
  const examsTomorrow = db
    .select({ title: exams.title, startsAt: exams.startsAt, course: courses.name })
    .from(exams)
    .innerJoin(courses, eq(courses.id, exams.courseId))
    .where(and(gte(exams.startsAt, tStart), lt(exams.startsAt, tEnd)))
    .all();
  for (const ex of examsTomorrow) {
    payloads.push({
      title: `🎯 Partiel demain : ${ex.course}`,
      body: `${ex.title} à ${fmtTime(ex.startsAt)}. Bon courage !`,
      url: "/exams",
      tag: `exam-${dayKey(ex.startsAt)}`,
    });
  }
  return payloads;
}

/** Tâche quotidienne de 17h30. Idempotente par jour (sauf `force`). */
export async function runDailyReminders({ force = false } = {}) {
  const today = dayKey(new Date());
  if (!force && getSetting<string | null>("reminders.lastSent", null) === today) {
    return { skipped: true, reason: "déjà envoyé aujourd'hui", notifications: 0 };
  }
  const payloads = buildDailyReminders();
  const results = [];
  for (const p of payloads) results.push(await sendPushToAll(p));
  // Un envoi forcé (test manuel) ne bloque pas le rappel planifié du jour
  if (!force) setSetting("reminders.lastSent", today);
  return { skipped: false, notifications: payloads.length, payloads, results };
}
