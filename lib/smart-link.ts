import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import { db } from "./db";
import { celcatEvents, type SessionType } from "./db/schema";

export interface SlotInfo {
  id: string;
  sessionType: SessionType;
  category: string;
  start: number;
  end: number;
  room: string;
  teacher: string;
}

export interface SmartSuggestion {
  /** Dernier cours passé ou cours en train d'avoir lieu pour cette matière */
  reference: (SlotInfo & { state: "ongoing" | "just-ended" | "past" }) | null;
  /** Prochain cours du MÊME type que la référence (TD → TD, CM → CM, TP → TP) */
  next: SlotInfo | null;
  /** Prochain créneau de chaque type, pour choisir manuellement */
  nextByType: Partial<Record<SessionType, SlotInfo>>;
}

const toSlot = (e: typeof celcatEvents.$inferSelect): SlotInfo => ({
  id: e.id,
  sessionType: e.sessionType,
  category: e.category,
  start: e.start.getTime(),
  end: e.end.getTime(),
  room: e.room,
  teacher: e.teacher,
});

export function getSmartSuggestion(courseId: number, now = new Date()): SmartSuggestion {
  const ref = db
    .select()
    .from(celcatEvents)
    .where(and(eq(celcatEvents.courseId, courseId), lte(celcatEvents.start, now), eq(celcatEvents.cancelled, false)))
    .orderBy(desc(celcatEvents.start))
    .limit(1)
    .get();

  const nextOf = (type: SessionType, category?: string) => {
    const rows = db
      .select()
      .from(celcatEvents)
      .where(and(eq(celcatEvents.courseId, courseId), eq(celcatEvents.sessionType, type), gt(celcatEvents.start, now), eq(celcatEvents.cancelled, false)))
      .orderBy(asc(celcatEvents.start))
      .limit(20)
      .all();
    // Pour AUTRE (Projet, Examen…), on exige la même catégorie brute
    const hit = type === "AUTRE" && category ? rows.find((r) => r.category === category) : rows[0];
    return hit ? toSlot(hit) : null;
  };

  const nextByType: SmartSuggestion["nextByType"] = {};
  for (const t of ["CM", "TD", "TP", "AUTRE"] as const) {
    const s = nextOf(t);
    if (s) nextByType[t] = s;
  }

  if (!ref) return { reference: null, next: null, nextByType };

  const endMs = ref.end.getTime();
  const state: "ongoing" | "just-ended" | "past" =
    endMs > now.getTime() ? "ongoing" : now.getTime() - endMs < 3 * 3600_000 ? "just-ended" : "past";

  return {
    reference: { ...toSlot(ref), state },
    next: nextOf(ref.sessionType, ref.category),
    nextByType,
  };
}
