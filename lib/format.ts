import { format, formatDistanceToNowStrict, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";

export const fmt = (d: Date | number, f: string) => format(d, f, { locale: fr });
export const fmtTime = (d: Date | number) => format(d, "HH:mm");
export const fmtDayLong = (d: Date | number) => fmt(d, "EEEE d MMMM");
export const fmtDayShort = (d: Date | number) => fmt(d, "EEE d MMM");
export const fmtDateTime = (d: Date | number) => fmt(d, "EEEE d MMMM 'à' HH'h'mm");
export const fmtRelative = (d: Date | number) =>
  formatDistanceToNowStrict(d, { locale: fr, addSuffix: true });

export function daysUntil(d: Date | number, now = new Date()) {
  return differenceInCalendarDays(d, now);
}

export function countdownLabel(d: Date | number, now = new Date()) {
  const n = daysUntil(d, now);
  if (n < 0) return "passé";
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  return `J-${n}`;
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Date formatée avec majuscule initiale uniquement ("Mercredi 16 décembre à 09h00") */
export const fmtCap = (d: Date | number, f: string) => capitalize(fmt(d, f));
