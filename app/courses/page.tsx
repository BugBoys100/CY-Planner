import Link from "next/link";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { FileText, Folder, GraduationCap, Notebook } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NewCourseButton } from "@/components/courses/new-course";
import { TypeBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { db } from "@/lib/db";
import { celcatEvents, courses, exams } from "@/lib/db/schema";
import { ensureInitialSync } from "@/lib/sync";
import { countdownLabel, fmt, fmtCap } from "@/lib/format";
import { hexToRgba } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cours" };

export default async function CoursesPage() {
  await ensureInitialSync();
  const now = new Date();
  const rows = db
    .select({
      c: courses,
      files: sql<number>`(select count(*) from files f where f.course_id = ${courses.id})`,
      notes: sql<number>`(select count(*) from notes n where n.course_id = ${courses.id})`,
      sessions: sql<number>`(select count(*) from celcat_events e where e.course_id = ${courses.id})`,
    })
    .from(courses)
    .orderBy(asc(courses.archived), asc(courses.name))
    .all();

  const nextByCourse = new Map<number, { start: Date; sessionType: "CM" | "TD" | "TP" | "AUTRE"; category: string }>();
  for (const e of db
    .select({ courseId: celcatEvents.courseId, start: celcatEvents.start, sessionType: celcatEvents.sessionType, category: celcatEvents.category })
    .from(celcatEvents)
    .where(and(gte(celcatEvents.start, now), eq(celcatEvents.cancelled, false)))
    .orderBy(asc(celcatEvents.start))
    .all()) {
    if (e.courseId && !nextByCourse.has(e.courseId)) nextByCourse.set(e.courseId, e);
  }
  const examByCourse = new Map<number, Date>();
  for (const x of db.select().from(exams).where(gte(exams.startsAt, now)).orderBy(asc(exams.startsAt)).all()) {
    if (!examByCourse.has(x.courseId)) examByCourse.set(x.courseId, x.startsAt);
  }

  const active = rows.filter((r) => !r.c.archived);
  const archived = rows.filter((r) => r.c.archived);

  return (
    <>
      <PageHeader title="Cours & matières" subtitle={`${active.length} matière${active.length > 1 ? "s" : ""}`} actions={<NewCourseButton />} />
      {active.length === 0 ? (
        <EmptyState>Aucune matière. Synchronise Celcat ou crée une matière manuellement.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map(({ c, files, notes, sessions }) => {
            const next = nextByCourse.get(c.id);
            const exam = examByCourse.get(c.id);
            return (
              <Link
                key={c.id}
                href={`/courses/${c.slug}`}
                className="group relative overflow-hidden rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="absolute inset-x-0 top-0 h-1" style={{ background: c.color }} />
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold" style={{ background: hexToRgba(c.color, 0.15), color: c.color }}>
                    {c.name.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 text-sm font-semibold leading-snug">{c.name}</h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{c.source === "celcat" ? `Celcat · ${sessions} séances` : "Matière manuelle"}</p>
                  </div>
                  {exam && (
                    <span className="flex shrink-0 items-center gap-1 rounded-md bg-exam/10 px-1.5 py-0.5 text-[11px] font-semibold text-exam">
                      <GraduationCap className="size-3" />{countdownLabel(exam, now)}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1"><FileText className="size-3.5" />{files}</span>
                    <span className="inline-flex items-center gap-1"><Notebook className="size-3.5" />{notes}</span>
                  </div>
                  {next && (
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      <TypeBadge type={next.sessionType} label={next.sessionType === "AUTRE" ? next.category : undefined} />
                      <span className="truncate">{fmtCap(next.start, "EEE d MMM HH'h'mm")}</span>
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Archivées ({archived.length})</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {archived.map(({ c }) => (
              <Link key={c.id} href={`/courses/${c.slug}`} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm hover:bg-muted">
                <Folder className="size-3.5" style={{ color: c.color }} /> {c.name}
              </Link>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
