import { eq } from "drizzle-orm";
import { db } from "./db";
import { courses, folders, type Course } from "./db/schema";
import { colorFromString, slugify } from "./utils";

export const DEFAULT_FOLDERS = ["CM", "TD", "TP", "Annales", "Fiches"];

/** Retourne la matière correspondant au slug, en la créant (avec ses dossiers par défaut) si besoin. */
export function ensureCourse(
  name: string,
  opts: { source?: "celcat" | "manual"; color?: string; slug?: string } = {},
): { course: Course; created: boolean } {
  const slug = opts.slug ?? slugify(name);
  const existing = db.select().from(courses).where(eq(courses.slug, slug)).get();
  if (existing) return { course: existing, created: false };
  const course = db
    .insert(courses)
    .values({
      slug,
      name,
      color: opts.color ?? colorFromString(slug),
      source: opts.source ?? "manual",
    })
    .returning()
    .get();
  for (const f of DEFAULT_FOLDERS) {
    db.insert(folders).values({ courseId: course.id, name: f }).run();
  }
  return { course, created: true };
}

export function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let i = 2;
  while (db.select({ id: courses.id }).from(courses).where(eq(courses.slug, slug)).get()) {
    slug = `${base}-${i++}`;
  }
  return slug;
}
