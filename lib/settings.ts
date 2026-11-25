import { eq } from "drizzle-orm";
import { db } from "./db";
import { settings } from "./db/schema";

export function getSetting<T>(key: string, fallback: T): T {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown) {
  const v = JSON.stringify(value);
  db.insert(settings)
    .values({ key, value: v })
    .onConflictDoUpdate({ target: settings.key, set: { value: v } })
    .run();
}

export interface CelcatSettings {
  baseUrl: string;
  resourceId: string;
  resourceType: number;
  cookie: string;
  username: string;
  password: string;
  /** libellé du groupe choisi (affichage) */
  resourceLabel: string;
}

/** Les réglages saisis dans /settings priment sur le .env */
export function getCelcatSettings(): CelcatSettings {
  const stored = getSetting<Partial<CelcatSettings>>("celcat", {});
  return {
    baseUrl: (stored.baseUrl ?? process.env.CELCAT_BASE_URL ?? "").trim().replace(/\/+$/, ""),
    resourceId: (stored.resourceId ?? process.env.CELCAT_RESOURCE_ID ?? "").trim(),
    resourceType: Number(stored.resourceType ?? process.env.CELCAT_RESOURCE_TYPE ?? 103) || 103,
    cookie: stored.cookie || process.env.CELCAT_COOKIE || "",
    username: stored.username || process.env.CELCAT_USERNAME || "",
    password: stored.password || process.env.CELCAT_PASSWORD || "",
    resourceLabel: stored.resourceLabel ?? "",
  };
}

export interface SyncStatus {
  at: number;
  mode: "live" | "mock";
  ok: boolean;
  fetched: number;
  upserted: number;
  removed: number;
  coursesCreated: number;
  examsImported?: number;
  error?: string;
}

export const getLastSync = () => getSetting<SyncStatus | null>("celcat.lastSync", null);
