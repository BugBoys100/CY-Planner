/**
 * Générateur d'emploi du temps factice au format brut Celcat (GetCalendarData).
 * Utilisé quand aucune URL Celcat n'est configurée : l'app est testable immédiatement
 * et le parseur réel est exercé sur des données réalistes.
 */
import type { CelcatRawEvent } from "./celcat";

const SLOTS = [
  ["08:30", "10:00"],
  ["10:15", "11:45"],
  ["13:00", "14:30"],
  ["14:45", "16:15"],
  ["16:30", "18:00"],
] as const;

interface Tpl {
  code: string;
  module: string;
  category: "CM" | "TD" | "TP" | "Projet" | "Examen";
  day: 1 | 2 | 3 | 4 | 5; // lundi..vendredi
  slot: 0 | 1 | 2 | 3 | 4;
  room: string;
  teacher: string;
  weeks?: "even" | "odd";
  color: string;
}

const T: Tpl[] = [
  { code: "ALGO", module: "INFO2104 - Algorithmique et structures de données", category: "CM", day: 1, slot: 0, room: "Amphi Turing", teacher: "MARTIN Claire", color: "#6366f1" },
  { code: "ALGO", module: "INFO2104 - Algorithmique et structures de données", category: "TD", day: 3, slot: 1, room: "Bât. A - A204", teacher: "BERNARD Julien", color: "#a5b4fc" },
  { code: "ALGO", module: "INFO2104 - Algorithmique et structures de données", category: "TP", day: 4, slot: 2, room: "Bât. E - E107 (salle info)", teacher: "BERNARD Julien", color: "#c7d2fe" },
  { code: "ANA", module: "MATH2201 - Analyse numérique", category: "CM", day: 1, slot: 1, room: "Amphi Lovelace", teacher: "PETIT Sophie", color: "#0ea5e9" },
  { code: "ANA", module: "MATH2201 - Analyse numérique", category: "TD", day: 2, slot: 2, room: "Bât. A - A112", teacher: "PETIT Sophie", color: "#7dd3fc" },
  { code: "PROBA", module: "MATH2305 - Probabilités et statistiques", category: "CM", day: 2, slot: 0, room: "Amphi Lovelace", teacher: "DUBOIS Marc", color: "#10b981" },
  { code: "PROBA", module: "MATH2305 - Probabilités et statistiques", category: "TD", day: 4, slot: 0, room: "Bât. A - A208", teacher: "LEROY Emma", color: "#6ee7b7" },
  { code: "POO", module: "INFO2302 - Programmation orientée objet (Java)", category: "CM", day: 3, slot: 0, room: "Amphi Turing", teacher: "MOREAU Thomas", color: "#f59e0b" },
  { code: "POO", module: "INFO2302 - Programmation orientée objet (Java)", category: "TP", day: 5, slot: 1, room: "Bât. E - E109 (salle info)", teacher: "MOREAU Thomas", color: "#fcd34d" },
  { code: "BDD", module: "INFO2408 - BASES DE DONNEES", category: "CM", day: 2, slot: 3, room: "Amphi Hopper", teacher: "SIMON Laura", color: "#ef4444" },
  { code: "BDD", module: "INFO2408 - BASES DE DONNEES", category: "TD", day: 5, slot: 2, room: "Bât. A - A215", teacher: "SIMON Laura", weeks: "even", color: "#fca5a5" },
  { code: "BDD", module: "INFO2408 - BASES DE DONNEES", category: "TP", day: 5, slot: 2, room: "Bât. E - E107 (salle info)", teacher: "GARCIA Hugo", weeks: "odd", color: "#fecaca" },
  { code: "RES", module: "INFO2510 - Réseaux", category: "CM", day: 4, slot: 1, room: "Amphi Hopper", teacher: "ROUX Antoine", color: "#8b5cf6" },
  { code: "RES", module: "INFO2510 - Réseaux", category: "TP", day: 1, slot: 3, room: "Bât. E - E110 (salle réseau)", teacher: "ROUX Antoine", weeks: "even", color: "#c4b5fd" },
  { code: "OS", module: "INFO2511 - Systèmes d'exploitation", category: "CM", day: 5, slot: 0, room: "Amphi Turing", teacher: "FOURNIER Paul", color: "#14b8a6" },
  { code: "OS", module: "INFO2511 - Systèmes d'exploitation", category: "TD", day: 1, slot: 4, room: "Bât. A - A110", teacher: "FOURNIER Paul", color: "#5eead4" },
  { code: "ANG", module: "LANG2001 - ANGLAIS", category: "TD", day: 3, slot: 2, room: "Bât. B - B003", teacher: "SMITH John", color: "#ec4899" },
  { code: "PROJ", module: "PROJ2900 - Projet de génie logiciel", category: "Projet", day: 4, slot: 3, room: "Bât. E - Fablab", teacher: "LAMBERT Chloé", color: "#f97316" },
];

const GROUP = "ING2 GI GR2";
const pad = (n: number) => String(n).padStart(2, "0");
const localIso = (d: Date, hm: string) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${hm}:00`;

function isHoliday(d: Date) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  // vacances de Noël + Toussaint (approx.)
  if ((m === 12 && day >= 20) || (m === 1 && day <= 3)) return true;
  if ((m === 10 && day >= 26) || (m === 11 && day <= 1)) return true;
  return false;
}

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function generateMockEvents(start: Date, end: Date): CelcatRawEvent[] {
  const out: CelcatRawEvent[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (d <= end) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5 && !isHoliday(d)) {
      const even = isoWeek(d) % 2 === 0;
      for (const t of T) {
        if (t.day !== dow) continue;
        if (t.weeks === "even" && !even) continue;
        if (t.weeks === "odd" && even) continue;
        const [s, e] = SLOTS[t.slot];
        const dateKey = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
        out.push({
          id: `mock-${dateKey}-${t.slot}-${t.code}-${t.category}`,
          start: localIso(d, s),
          end: localIso(d, e),
          allDay: false,
          description: [t.category, t.room, GROUP, t.module, t.teacher].join("<br />\r\n\r\n"),
          backgroundColor: t.color,
          textColor: "#000000",
          department: "CY Tech",
          faculty: null,
          eventCategory: t.category,
          sites: ["Cergy"],
          modules: [t.module],
          registerStatus: 0,
          studentMark: 0,
          custom1: null,
          custom2: null,
          custom3: null,
        });
      }
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export const MOCK_RESOURCES = [
  { id: "ING1-GI-GR1", text: "ING1 GI GR1", dept: "CY Tech" },
  { id: "ING1-GI-GR2", text: "ING1 GI GR2", dept: "CY Tech" },
  { id: "ING2-GI-GR1", text: "ING2 GI GR1", dept: "CY Tech" },
  { id: "ING2-GI-GR2", text: "ING2 GI GR2", dept: "CY Tech" },
  { id: "ING2-GSI-GR1", text: "ING2 GSI GR1", dept: "CY Tech" },
  { id: "ING3-IA-GR1", text: "ING3 IA GR1", dept: "CY Tech" },
];
