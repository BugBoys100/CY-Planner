/* Tests rapides de la logique pure : parseur Celcat + générateur de révisions */
import assert from "node:assert/strict";
import { normalizeSubject, detectSessionType, parseCelcatEvent } from "../lib/celcat";
import { generateMockEvents } from "../lib/celcat-mock";
import { generateSessions, generateBalancedSessions, spreadIndices, candidateDays } from "../lib/revision";

assert.equal(normalizeSubject("INFO2104 - Algorithmique et structures de données"), "Algorithmique et structures de données");
assert.equal(normalizeSubject("INFO2408 - BASES DE DONNEES"), "Bases de donnees");
assert.equal(normalizeSubject("ALGORITHMIQUE AVANCEE (TD) GR2"), "Algorithmique avancee");
assert.equal(normalizeSubject("TD Analyse 1"), "Analyse 1");
assert.equal(normalizeSubject("Programmation C - CM"), "Programmation C");
assert.equal(normalizeSubject("PROGRAMMATION C"), "Programmation C");
assert.equal(detectSessionType("Travaux dirigés"), "TD");
assert.equal(detectSessionType("Cours Magistral"), "CM");
assert.equal(detectSessionType("TP Réseaux"), "TP");
assert.equal(detectSessionType("Projet"), "AUTRE");

// Description brute sans `modules`
const p = parseCelcatEvent({
  id: "1", start: "2026-11-25T08:30:00", end: "2026-11-25T10:00:00", allDay: false,
  description: "TD<br />\r\n\r\nBât. A - A204<br />\r\n\r\nING2 GI GR2<br />\r\n\r\nALGORITHMIQUE AVANCEE<br />\r\n\r\nDUPONT Jean",
  eventCategory: "TD", sites: ["Cergy"], modules: null,
})!;
assert.equal(p.sessionType, "TD");
assert.equal(p.subject, "Algorithmique avancee");
assert.equal(p.room, "Bât. A - A204");
assert.equal(p.groups, "ING2 GI GR2");
assert.equal(p.teacher, "DUPONT Jean");

const mocks = generateMockEvents(new Date(2026, 10, 23), new Date(2026, 10, 29));
const parsed = mocks.map(parseCelcatEvent);
assert.ok(parsed.length > 10);
for (const e of parsed) {
  assert.ok(e && e.subject && !/\b(CM|TD|TP)\b/.test(e.subject), `subject: ${e?.subject}`);
  assert.ok(e!.teacher, `teacher missing for ${e!.id}`);
  assert.ok(e!.room, `room missing for ${e!.id}`);
}

// Format CY Tech réel (anonymisé) : `modules` = code, matière dans la description
const cy = (desc: string, cat: string, mod: string | null) =>
  parseCelcatEvent({ id: "x", start: "2026-11-25T08:00:00", end: "2026-11-25T09:30:00", allDay: false, description: desc, eventCategory: cat, modules: mod ? [mod] : null, sites: null })!;
const opl = cy("TD<br />ING1 GI Pau S1 Groupe 1<br />Optimisation lin&#233;aire<br />PAU E102 SALLE POLYVALENTE (TD ET INFO) 40p<br />DUPONT JEAN", "TD", "DIDB1OPL(DI01C1-260)");
assert.equal(opl.subject, "Optimisation linéaire");
assert.equal(opl.code, "DIDB1OPL(DI01C1-260)");
assert.equal(opl.sessionType, "TD");
assert.equal(opl.room, "PAU E102 SALLE POLYVALENTE (TD ET INFO) 40p");
assert.equal(opl.teacher, "DUPONT JEAN");
assert.equal(opl.groups, "ING1 GI Pau S1 Groupe 1");
assert.equal(opl.cancelled, false);
const bdd = cy("CM<br />ING1 GI S1 Promo Pau<br />Base de donn&#233;es<br />PAU A001 AMPHITH&#201;&#194;TRE 202p<br />MARTIN ANNE<br />DURAND PAUL", "CM", "DIDB1BDD(DI01C1-260)");
assert.equal(bdd.subject, "Base de données");
assert.equal(bdd.sessionType, "CM");
assert.equal(bdd.teacher, "MARTIN ANNE, DURAND PAUL");
const annule = cy("Annul&#233;<br />TD<br />ING1 GI Pau S1 Groupe 1<br />Projet personnel et prof<br />PAU E102 SALLE<br />DUPONT JEAN", "TD", "DIDD1PPP(DI01C1-260)");
assert.equal(annule.cancelled, true);
assert.equal(annule.subject, "Projet personnel et prof");
assert.equal(annule.sessionType, "TD");
const examEv = cy("Examens<br />ING1 GI S1 Promo Pau<br />Algorithmique<br />PAU A001 AMPHI<br />DUPONT JEAN", "Examens", "DIDA1APE(DI01C1-260)");
assert.equal(examEv.subject, "Algorithmique");
assert.equal(examEv.isCourse, true);
assert.equal(cy("TD<br />ING1 GI S1 Promo Pau<br />LV1<br />PAU E201 SALLE 30p<br />DUPONT JEAN", "TD", "DIDANG1D(DI01C1-260)").subject, "Anglais (LV1)");
const ferie = cy("Jour f&#233;ri&#233;<br />Indisponibilit&#233;", "Indisponibilité", null);
assert.equal(ferie.subject, "Jour férié");
assert.equal(ferie.isCourse, false);
const reunion = cy("Pr&#233;sentation stages<br />R&#233;unions<br />ING1 GI S1 Promo Pau<br />PAU A001 AMPHI", "Réunions", null);
assert.equal(reunion.isCourse, false);

// Révisions
assert.deepEqual(spreadIndices(14, 7), [1, 3, 5, 7, 9, 11, 13]);
assert.deepEqual(spreadIndices(5, 1), [4]);
const today = new Date(2026, 10, 25, 10);
const exam = new Date(2026, 11, 9, 8, 30); // 14 jours plus tard
assert.equal(candidateDays(exam, today).length, 14);
assert.equal(generateSessions({ examAt: exam, percent: 25, today }).length, 4);
assert.equal(generateSessions({ examAt: exam, percent: 50, today }).length, 7);
assert.equal(generateSessions({ examAt: exam, percent: 75, today }).length, 11);
assert.equal(generateSessions({ examAt: exam, percent: 100, today }).length, 14);
assert.equal(generateSessions({ examAt: exam, percent: 0, today }).length, 0);
const s = generateSessions({ examAt: exam, percent: 50, today });
assert.equal(s.at(-1)!.date, "2026-12-08"); // veille du partiel
assert.equal(generateSessions({ examAt: new Date(2026, 10, 26, 8), percent: 25, today }).length, 1);

// Plusieurs partiels la même semaine : la charge quotidienne reste faible
const load = new Map<string, number>();
for (let i = 0; i < 9; i++) generateBalancedSessions({ examAt: new Date(2027, 0, 11 + Math.floor(i / 2), 9), percent: 25, today, load });
assert.ok(Math.max(...load.values()) <= 3, `charge max ${Math.max(...load.values())}`);

console.log("✔ Tous les tests de logique passent");
console.table(parsed.slice(0, 6).map((e) => ({ subject: e!.subject, type: e!.sessionType, room: e!.room, teacher: e!.teacher })));
