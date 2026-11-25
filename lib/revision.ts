/**
 * Générateur de sessions de révision — pur, partagé client/serveur.
 * Utilisé pour la prévisualisation instantanée dans la modale ET pour la validation côté serveur.
 */
import type { RevisionLevel } from "./db/schema";
import { addDaysKey, dayKey, fromDayKey } from "./utils";

export const LEVELS: { id: RevisionLevel; label: string; percent: number; hint: string }[] = [
  { id: "none", label: "Aucun", percent: 0, hint: "Pas de révision planifiée" },
  { id: "low", label: "Faible", percent: 25, hint: "≈ 1 à 2 jours / semaine" },
  { id: "medium", label: "Moyen", percent: 50, hint: "≈ 3 à 4 jours / semaine" },
  { id: "high", label: "Beaucoup", percent: 75, hint: "≈ 5 jours / semaine" },
  { id: "custom", label: "Personnalisé", percent: 60, hint: "De 1 % à 100 %" },
];

export function percentForLevel(level: RevisionLevel, custom: number) {
  if (level === "custom") return Math.min(100, Math.max(1, Math.round(custom || 0)));
  return LEVELS.find((l) => l.id === level)?.percent ?? 0;
}

export interface DraftSession {
  key: string;
  date: string; // YYYY-MM-DD
  startTime: string | null; // HH:mm
  durationMinutes: number;
  title: string;
  description: string;
}

/** Jours candidats : d'aujourd'hui à la veille du partiel (inclus). */
export function candidateDays(examAt: Date, today = new Date()): string[] {
  const first = dayKey(today);
  const last = addDaysKey(dayKey(examAt), -1);
  const days: string[] = [];
  for (let k = first; k <= last; k = addDaysKey(k, 1)) days.push(k);
  return days;
}

/** Indices répartis équitablement, la dernière session tombant la veille du partiel. */
export function spreadIndices(n: number, k: number): number[] {
  if (k <= 0 || n <= 0) return [];
  k = Math.min(k, n);
  const out: number[] = [];
  for (let i = 0; i < k; i++) out.push(n - 1 - Math.floor(((k - 1 - i) * n) / k));
  return [...new Set(out)].sort((a, b) => a - b);
}

function defaultTitle(i: number, k: number) {
  if (k === 1) return "Révision complète : fiches + annales";
  if (i === k - 1) return "Révision finale : annales en conditions réelles";
  if (i === 0) return "Relire les CM et faire les fiches de synthèse";
  if (k >= 4 && i === k - 2) return "Annales & points faibles";
  const cycle = ["Refaire les exercices de TD", "Reprendre les TP / exercices types", "Relire les fiches + exercices"];
  return cycle[(i - 1) % cycle.length];
}

function defaultDescription(i: number, k: number) {
  if (i === k - 1) return "Sujet d'annale chronométré, puis relecture rapide des fiches.";
  if (i === 0) return "Objectif : avoir une fiche par chapitre.";
  return "";
}

let seq = 0;
export const newKey = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

export function generateSessions(opts: {
  examAt: Date;
  percent: number;
  today?: Date;
  startTime?: string;
  durationMinutes?: number;
}): DraftSession[] {
  const { examAt, percent, today = new Date(), startTime = "18:00", durationMinutes = 90 } = opts;
  if (!(examAt instanceof Date) || isNaN(examAt.getTime()) || percent <= 0) return [];
  const days = candidateDays(examAt, today);
  const n = days.length;
  let k = Math.round((n * percent) / 100);
  if (k === 0 && n > 0) k = 1;
  const idx = spreadIndices(n, k);
  return idx.map((d, i) => ({
    key: newKey(),
    date: days[d],
    startTime,
    durationMinutes,
    title: defaultTitle(i, idx.length),
    description: defaultDescription(i, idx.length),
  }));
}

export function sortSessions<T extends { date: string; startTime: string | null }>(s: T[]) {
  return [...s].sort((a, b) =>
    a.date === b.date ? (a.startTime ?? "").localeCompare(b.startTime ?? "") : a.date.localeCompare(b.date),
  );
}

export function sessionStart(s: { date: string; startTime: string | null }) {
  return fromDayKey(s.date, s.startTime ?? "18:00");
}

/**
 * Variante équilibrée pour plusieurs partiels : la période est découpée en k tranches égales et,
 * dans chaque tranche, on prend le jour le moins chargé (`load` = nb de révisions déjà prévues ce jour-là).
 * La dernière session reste la veille du partiel. `load` est mis à jour.
 */
export function generateBalancedSessions(opts: {
  examAt: Date;
  percent: number;
  load: Map<string, number>;
  today?: Date;
  durationMinutes?: number;
}): DraftSession[] {
  const { examAt, percent, load, today = new Date(), durationMinutes = 90 } = opts;
  if (percent <= 0) return [];
  const days = candidateDays(examAt, today);
  const n = days.length;
  if (!n) return [];
  let k = Math.round((n * percent) / 100);
  if (k === 0) k = 1;
  k = Math.min(k, n);
  const picked: string[] = [];
  for (let i = 0; i < k; i++) {
    const lo = Math.floor((i * n) / k);
    const hi = Math.max(lo, Math.floor(((i + 1) * n) / k) - 1);
    let best = hi;
    if (i < k - 1) {
      for (let d = hi; d >= lo; d--) if ((load.get(days[d]) ?? 0) < (load.get(days[best]) ?? 0)) best = d;
    }
    picked.push(days[best]);
    load.set(days[best], (load.get(days[best]) ?? 0) + 1);
  }
  return picked.map((date, i) => ({
    key: newKey(),
    date,
    startTime: null,
    durationMinutes,
    title: defaultTitle(i, picked.length),
    description: defaultDescription(i, picked.length),
  }));
}
