import { and, eq, gte, lte, like, notInArray, sql } from "drizzle-orm";
import { db } from "./db";
import { celcatEvents, courses } from "./db/schema";
import { fetchCalendarData, isCodeLike, normalizeSubject, parseCelcatEvent, type CelcatRawEvent, type ParsedCelcatEvent } from "./celcat";
import { generateMockEvents } from "./celcat-mock";
import { ensureCourse, uniqueSlug } from "./courses";
import { importCelcatExams } from "./exam-import";
import { slugify } from "./utils";
import { getCelcatSettings, setSetting, type SyncStatus } from "./settings";

export const SYNC_PAST_DAYS = 42;
export const SYNC_FUTURE_DAYS = 160;

let running: Promise<SyncStatus> | null = null;

export function isMockMode() {
  const cfg = getCelcatSettings();
  return !cfg.baseUrl || !cfg.resourceId;
}

/** Synchronise l'emploi du temps Celcat (ou mock) dans SQLite. Appels concurrents mutualisés. */
export function syncCelcat(): Promise<SyncStatus> {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

async function doSync(): Promise<SyncStatus> {
  const cfg = getCelcatSettings();
  const mode: "live" | "mock" = cfg.baseUrl && cfg.resourceId ? "live" : "mock";
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - SYNC_PAST_DAYS);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + SYNC_FUTURE_DAYS);

  let raw: CelcatRawEvent[];
  try {
    raw =
      mode === "live"
        ? await fetchCalendarData(cfg, start, end)
        : generateMockEvents(start, end);
  } catch (e) {
    const status: SyncStatus = {
      at: Date.now(), mode, ok: false, fetched: 0, upserted: 0, removed: 0, coursesCreated: 0,
      error: e instanceof Error ? e.message : String(e),
    };
    setSetting("celcat.lastSync", status);
    return status;
  }

  const parsed = raw.map(parseCelcatEvent).filter((e): e is NonNullable<typeof e> => !!e);
  const syncedAt = new Date();
  let coursesCreated = 0;
  let removed = 0;

  db.transaction(() => {
    const courseCache = new Map<string, number | null>();
    for (const ev of parsed) {
      const key = ev.isCourse ? ev.code || ev.slug : "";
      let courseId = courseCache.get(key);
      if (courseId === undefined) {
        const r = resolveCourse(ev);
        if (r?.created) coursesCreated++;
        courseId = r?.id ?? null;
        courseCache.set(key, courseId);
      }
      const values = {
        id: ev.id,
        courseId,
        code: ev.code,
        cancelled: ev.cancelled,
        subject: ev.subject,
        rawSubject: ev.rawSubject,
        sessionType: ev.sessionType,
        category: ev.category,
        start: ev.start,
        end: ev.end,
        allDay: ev.allDay,
        room: ev.room,
        teacher: ev.teacher,
        groups: ev.groups,
        rawDescription: ev.rawDescription,
        color: ev.color,
        syncedAt,
      };
      const { id: _id, ...update } = values;
      db.insert(celcatEvents).values(values).onConflictDoUpdate({ target: celcatEvents.id, set: update }).run();
    }

    // Suppression des événements annulés / disparus dans la fenêtre synchronisée
    const ids = parsed.map((p) => p.id);
    const inWindow = and(gte(celcatEvents.start, start), lte(celcatEvents.start, end));
    const res = db
      .delete(celcatEvents)
      .where(ids.length ? and(inWindow, notInArray(celcatEvents.id, ids)) : inWindow)
      .run();
    removed += res.changes;
    // Passage mock → live : on purge toutes les données de démo
    if (mode === "live") removed += db.delete(celcatEvents).where(like(celcatEvents.id, "mock-%")).run().changes;
    else removed += db.delete(celcatEvents).where(sql`${celcatEvents.id} NOT LIKE 'mock-%'`).run().changes;
  });

  removeEmptyCelcatCourses();
  let examsImported = 0;
  try {
    examsImported = importCelcatExams().created;
  } catch (e) {
    console.error("[sync] import des partiels :", e);
  }

  const status: SyncStatus = {
    at: Date.now(), mode, ok: true, fetched: raw.length, upserted: parsed.length, removed, coursesCreated, examsImported,
  };
  setSetting("celcat.lastSync", status);
  return status;
}

/** Synchronise automatiquement si la base est vide (premier lancement). */
export async function ensureInitialSync() {
  const row = db.select({ n: sql<number>`count(*)` }).from(celcatEvents).get();
  if (!row || row.n === 0) await syncCelcat();
}

/**
 * Trouve (ou crée) la matière d'un événement. Le code module Celcat est l'identifiant stable ;
 * les matières créées par une ancienne version (nommées d'après le code, ex. "Didb1opl(di01c1-260)")
 * sont renommées en place pour conserver fichiers, notes et partiels.
 */
function resolveCourse(ev: ParsedCelcatEvent): { id: number; created: boolean } | null {
  if (!ev.isCourse) return null;
  if (ev.code) {
    const byCode = db.select().from(courses).where(eq(courses.code, ev.code)).get();
    if (byCode) {
      // Nom encore dérivé du code → on le remplace par le vrai nom
      if (byCode.source === "celcat" && isCodeLike(byCode.name) && byCode.name !== ev.subject && !isCodeLike(ev.subject)) {
        db.update(courses).set({ name: ev.subject, slug: freeSlug(ev.subject, byCode.id) }).where(eq(courses.id, byCode.id)).run();
      }
      return { id: byCode.id, created: false };
    }
    const legacySlug = slugify(normalizeSubject(ev.code));
    const legacy = db.select().from(courses).where(eq(courses.slug, legacySlug)).get();
    if (legacy && !legacy.code) {
      db.update(courses)
        .set({ code: ev.code, ...(isCodeLike(ev.subject) ? {} : { name: ev.subject, slug: freeSlug(ev.subject, legacy.id) }) })
        .where(eq(courses.id, legacy.id))
        .run();
      return { id: legacy.id, created: false };
    }
    const bySlug = db.select().from(courses).where(eq(courses.slug, ev.slug)).get();
    if (bySlug && !bySlug.code) {
      db.update(courses).set({ code: ev.code }).where(eq(courses.id, bySlug.id)).run();
      return { id: bySlug.id, created: false };
    }
    const { course, created } = ensureCourse(ev.subject, {
      source: "celcat",
      slug: bySlug ? uniqueSlug(ev.subject) : ev.slug,
    });
    db.update(courses).set({ code: ev.code }).where(eq(courses.id, course.id)).run();
    return { id: course.id, created };
  }
  const { course, created } = ensureCourse(ev.subject, { source: "celcat", slug: ev.slug });
  return { id: course.id, created };
}

function freeSlug(name: string, selfId: number) {
  const base = slugify(name);
  const taken = db.select({ id: courses.id }).from(courses).where(eq(courses.slug, base)).get();
  return !taken || taken.id === selfId ? base : uniqueSlug(name);
}

/** Supprime les matières Celcat devenues orphelines et sans aucun contenu utilisateur. */
function removeEmptyCelcatCourses() {
  return db.run(sql`
    DELETE FROM courses WHERE source = 'celcat' AND memo = ''
      AND NOT EXISTS (SELECT 1 FROM celcat_events e WHERE e.course_id = courses.id)
      AND NOT EXISTS (SELECT 1 FROM files f WHERE f.course_id = courses.id)
      AND NOT EXISTS (SELECT 1 FROM notes n WHERE n.course_id = courses.id)
      AND NOT EXISTS (SELECT 1 FROM exams x WHERE x.course_id = courses.id)
      AND NOT EXISTS (SELECT 1 FROM custom_events c WHERE c.course_id = courses.id)
      AND NOT EXISTS (SELECT 1 FROM course_links l WHERE l.course_id = courses.id)
  `);
}
