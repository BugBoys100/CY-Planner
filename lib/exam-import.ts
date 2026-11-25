/**
 * Import automatique des épreuves Celcat (catégorie "Examens", "Partiel", "Contrôle"…) en partiels,
 * avec génération des sessions de révision. Appelé après chaque synchronisation.
 */
import { and, eq, gt, gte, isNotNull, isNull } from "drizzle-orm";
import { db } from "./db";
import { celcatEvents, courses, exams, revisionSessions, type RevisionLevel } from "./db/schema";
import { generateBalancedSessions, percentForLevel } from "./revision";
import { getSetting, setSetting } from "./settings";
import { dayKey } from "./utils";

export const EXAM_CATEGORY_RE = /exam|partiel|contr[oô]le|\bDS\b|rattrapage|soutenance/i;

export interface ExamImportSettings {
  enabled: boolean;
  level: RevisionLevel;
  customPercent: number;
}

export const DEFAULT_EXAM_IMPORT: ExamImportSettings = { enabled: true, level: "low", customPercent: 25 };

export const getExamImportSettings = () => ({ ...DEFAULT_EXAM_IMPORT, ...getSetting<Partial<ExamImportSettings>>("exams.import", {}) });
export const getDismissedExams = () => new Set(getSetting<string[]>("exams.dismissed", []));

/** Un partiel importé puis supprimé par l'utilisateur n'est plus jamais recréé. */
export function dismissCelcatExam(celcatEventId: string) {
  const s = getDismissedExams();
  s.add(celcatEventId);
  setSetting("exams.dismissed", [...s]);
}

/** Créneaux du soir décalés quand plusieurs révisions tombent le même jour */
const SLOTS = ["18:00", "19:45", "21:15", "16:30", "14:45", "10:00"];

function freeSlot(date: string, taken: Map<string, number>) {
  const n = taken.get(date) ?? 0;
  taken.set(date, n + 1);
  return SLOTS[Math.min(n, SLOTS.length - 1)];
}

export function importCelcatExams(now = new Date()) {
  const cfg = getExamImportSettings();
  const result = { created: 0, updated: 0, linked: 0, sessions: 0 };
  if (!cfg.enabled) return result;
  const dismissed = getDismissedExams();
  const percent = percentForLevel(cfg.level, cfg.customPercent);

  const candidates = db
    .select({ e: celcatEvents, c: courses })
    .from(celcatEvents)
    .innerJoin(courses, eq(courses.id, celcatEvents.courseId))
    .where(and(gt(celcatEvents.start, now), eq(celcatEvents.cancelled, false)))
    .orderBy(celcatEvents.start)
    .all()
    .filter(({ e }) => EXAM_CATEGORY_RE.test(e.category) && !dismissed.has(e.id));
  if (!candidates.length) return result;

  // Occupation actuelle des soirées (toutes révisions futures confondues)
  const taken = new Map<string, number>();
  for (const s of db.select({ date: revisionSessions.date }).from(revisionSessions).where(gte(revisionSessions.date, dayKey(now))).all()) {
    taken.set(s.date, (taken.get(s.date) ?? 0) + 1);
  }

  db.transaction(() => {
    for (const { e, c } of candidates) {
      const duration = Math.max(15, Math.round((e.end.getTime() - e.start.getTime()) / 60000));
      const existing = db.select().from(exams).where(eq(exams.celcatEventId, e.id)).get();

      if (existing) {
        // Celcat a déplacé l'épreuve : on suit, et on retire les révisions devenues postérieures
        if (existing.startsAt.getTime() !== e.start.getTime() || existing.durationMinutes !== duration || existing.location !== e.room) {
          db.update(exams).set({ startsAt: e.start, durationMinutes: duration, location: e.room }).where(eq(exams.id, existing.id)).run();
          db.delete(revisionSessions)
            .where(and(eq(revisionSessions.examId, existing.id), gte(revisionSessions.date, dayKey(e.start)), eq(revisionSessions.done, false)))
            .run();
          result.updated++;
        }
        continue;
      }

      // Partiel déjà créé à la main pour cette matière le même jour → on le rattache au lieu de dupliquer
      const manual = db
        .select()
        .from(exams)
        .where(and(eq(exams.courseId, c.id), isNull(exams.celcatEventId)))
        .all()
        .find((x) => dayKey(x.startsAt) === dayKey(e.start));
      if (manual) {
        db.update(exams).set({ celcatEventId: e.id, startsAt: e.start, durationMinutes: duration, location: e.room || manual.location }).where(eq(exams.id, manual.id)).run();
        result.linked++;
        continue;
      }

      const exam = db
        .insert(exams)
        .values({
          courseId: c.id,
          title: `Partiel de ${c.name}`,
          startsAt: e.start,
          durationMinutes: duration,
          location: e.room,
          revisionLevel: cfg.level,
          revisionPercent: percent,
          celcatEventId: e.id,
        })
        .returning()
        .get();
      result.created++;

      const load = new Map(taken);
      for (const s of generateBalancedSessions({ examAt: e.start, percent, today: now, load })) {
        db.insert(revisionSessions)
          .values({
            examId: exam.id,
            courseId: c.id,
            date: s.date,
            startTime: freeSlot(s.date, taken),
            durationMinutes: s.durationMinutes,
            title: s.title,
            description: s.description,
          })
          .run();
        result.sessions++;
      }
    }
  });
  return result;
}

/** Nombre de partiels liés à Celcat (pour l'affichage) */
export function countImportedExams() {
  return db.select({ id: exams.id }).from(exams).where(isNotNull(exams.celcatEventId)).all().length;
}
