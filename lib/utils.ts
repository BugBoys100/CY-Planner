import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function slugify(s: string) {
  return (
    stripAccents(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "matiere"
  );
}

export const COURSE_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#06b6d4", "#a855f7",
];

export function colorFromString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COURSE_COLORS[h % COURSE_COLORS.length];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Clé de jour locale YYYY-MM-DD */
export function dayKey(d: Date | number) {
  const x = typeof d === "number" ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/** YYYY-MM-DD (+ HH:mm) → Date locale */
export function fromDayKey(key: string, time?: string | null) {
  const [y, m, d] = key.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}

export function addDaysKey(key: string, n: number) {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Valeur pour <input type="datetime-local"> */
export function toDatetimeLocal(d: Date | number) {
  const x = typeof d === "number" ? new Date(d) : d;
  return `${dayKey(x)}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} Ko`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} Mo`;
  return `${(n / 1024 ** 3).toFixed(1)} Go`;
}

export function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
