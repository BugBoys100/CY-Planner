import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { ArrowLeft, CalendarClock, GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MemoLinks } from "@/components/courses/memo-links";
import { Explorer } from "@/components/courses/explorer";
import { CourseActions } from "@/components/courses/course-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TypeBadge } from "@/components/ui/badge";
import { EventList } from "@/components/dashboard/quick-actions";
import { db } from "@/lib/db";
import { celcatEvents, courseLinks, courses, customEvents, exams, files, folders, notes, type SessionType } from "@/lib/db/schema";
import { getCourseOptions } from "@/lib/queries";
import { previewKind } from "@/lib/storage";
import { countdownLabel, fmt, fmtCap } from "@/lib/format";
import { dayKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = db.select({ name: courses.name }).from(courses).where(eq(courses.slug, slug)).get();
  return { title: c?.name ?? "Matière" };
}

export default async function CoursePage({
  params, searchParams,
}: { params: Promise<{ slug: string }>; searchParams: Promise<{ folder?: string }> }) {
  const { slug } = await params;
  const { folder } = await searchParams;
  const course = db.select().from(courses).where(eq(courses.slug, slug)).get();
  if (!course) notFound();
  const now = new Date();

  const links = db.select().from(courseLinks).where(eq(courseLinks.courseId, course.id)).orderBy(asc(courseLinks.position)).all();
  const folderRows = db.select().from(folders).where(eq(folders.courseId, course.id)).orderBy(asc(folders.name)).all();
  const fileRows = db.select().from(files).where(eq(files.courseId, course.id)).orderBy(asc(files.name)).all();
  const noteRows = db
    .select({ id: notes.id, title: notes.title, folderId: notes.folderId, updatedAt: notes.updatedAt })
    .from(notes).where(eq(notes.courseId, course.id)).orderBy(asc(notes.title)).all();

  const upcoming = db.select().from(celcatEvents)
    .where(and(eq(celcatEvents.courseId, course.id), gte(celcatEvents.end, now), eq(celcatEvents.cancelled, false)))
    .orderBy(asc(celcatEvents.start)).limit(40).all();
  const nextByType = new Map<SessionType, (typeof upcoming)[number]>();
  for (const e of upcoming) if (!nextByType.has(e.sessionType)) nextByType.set(e.sessionType, e);

  const courseExams = db.select().from(exams).where(and(eq(exams.courseId, course.id), gte(exams.startsAt, now))).orderBy(asc(exams.startsAt)).all();
  const events = db.select().from(customEvents)
    .where(and(eq(customEvents.courseId, course.id), gte(customEvents.startsAt, new Date(now.getTime() - 86400_000))))
    .orderBy(asc(customEvents.startsAt)).limit(10).all();
  const courseOpts = getCourseOptions();
  const cRef = { name: course.name, color: course.color, slug: course.slug };

  return (
    <>
      <PageHeader
        back={
          <Link href="/courses" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Retour">
            <ArrowLeft className="size-5" />
          </Link>
        }
        title={
          <span className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ background: course.color }} />
            <span className="truncate">{course.name}</span>
          </span>
        }
        subtitle={course.source === "celcat" ? "Matière synchronisée depuis Celcat" : "Matière manuelle"}
        actions={<CourseActions course={{ id: course.id, name: course.name, color: course.color, archived: course.archived }} courses={courseOpts} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <MemoLinks courseId={course.id} memo={course.memo} links={links.map((l) => ({ id: l.id, label: l.label, url: l.url }))} />
          <Explorer
            course={{ id: course.id, slug: course.slug, color: course.color }}
            initialFolder={Number(folder) || null}
            folders={folderRows.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }))}
            files={fileRows.map((f) => ({
              id: f.id, name: f.name, folderId: f.folderId, size: f.size, mimeType: f.mimeType,
              createdAt: f.createdAt.getTime(), preview: previewKind(f.mimeType, f.name),
            }))}
            notes={noteRows.map((n) => ({ id: n.id, title: n.title, folderId: n.folderId, updatedAt: n.updatedAt.getTime() }))}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader icon={<CalendarClock />} title="Prochaines séances" />
            <CardContent className="space-y-2">
              {(["CM", "TD", "TP", "AUTRE"] as const).filter((t) => nextByType.has(t)).map((t) => {
                const e = nextByType.get(t)!;
                const ongoing = e.start <= now;
                return (
                  <div key={t} className="flex items-center gap-2.5 rounded-lg border p-2">
                    <TypeBadge type={t} label={t === "AUTRE" ? e.category : undefined} className="w-12 justify-center" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium">
                        {ongoing ? <span className="text-primary">En cours</span> : dayKey(e.start) === dayKey(now) ? "Aujourd'hui" : fmtCap(e.start, "EEEE d MMM")}
                        <span className="text-muted-foreground"> · {fmt(e.start, "HH'h'mm")}–{fmt(e.end, "HH'h'mm")}</span>
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{[e.room, e.teacher].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                );
              })}
              {nextByType.size === 0 && <p className="text-sm text-muted-foreground">Aucune séance à venir.</p>}
            </CardContent>
          </Card>

          {courseExams.length > 0 && (
            <Card>
              <CardHeader icon={<GraduationCap />} title="Partiels" />
              <CardContent className="space-y-2">
                {courseExams.map((x) => (
                  <Link key={x.id} href="/exams" className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm hover:bg-muted">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{x.title}</span>
                      <span className="block text-[11px] text-muted-foreground">{fmtCap(x.startsAt, "EEEE d MMMM 'à' HH'h'mm")}</span>
                    </span>
                    <span className="shrink-0 rounded-md bg-exam/10 px-1.5 py-0.5 text-xs font-bold text-exam">{countdownLabel(x.startsAt, now)}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader title="Devoirs & événements" />
            <CardContent>
              <EventList
                courses={courseOpts}
                empty="Aucun devoir pour cette matière"
                events={events.map((e) => ({
                  id: e.id, title: e.title, description: e.description, kind: e.kind, startsAt: e.startsAt.getTime(),
                  allDay: e.allDay, done: e.done, linkedSessionType: e.linkedSessionType, courseId: e.courseId, course: cRef,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
