import Link from "next/link";
import { AlarmClock, BookOpen, CalendarClock, CheckCircle2, ClipboardList, Flame, GraduationCap, Sunrise } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SyncButton } from "@/components/sync-button";
import { Card, CardContent, CardHeader, EmptyState } from "@/components/ui/card";
import { CourseBadge } from "@/components/ui/badge";
import { SessionItem, type ClassItemData, type EventItemData, type SessionItemData } from "@/components/items";
import { EventList, QuickActions } from "@/components/dashboard/quick-actions";
import { LiveClasses } from "@/components/dashboard/live-classes";
import { ensureInitialSync, isMockMode } from "@/lib/sync";
import {
  getCelcatDay, getCourseOptions, getExams, getNextCourseDay, getOverdueEvents, getSessionsForDay, getUpcomingEvents,
} from "@/lib/queries";
import { addDaysKey, dayKey, fromDayKey } from "@/lib/utils";
import { capitalize, countdownLabel, daysUntil, fmt, fmtDayLong, fmtCap } from "@/lib/format";

export const dynamic = "force-dynamic";

function toSession(r: ReturnType<typeof getSessionsForDay>[number]): SessionItemData {
  return {
    id: r.s.id, title: r.s.title, description: r.s.description, startTime: r.s.startTime,
    durationMinutes: r.s.durationMinutes, done: r.s.done, examTitle: r.examTitle,
    course: { name: r.c.name, color: r.c.color, slug: r.c.slug },
  };
}

function toEvent(r: ReturnType<typeof getUpcomingEvents>[number]): EventItemData & { courseId: number | null } {
  return {
    id: r.e.id, title: r.e.title, description: r.e.description, kind: r.e.kind, startsAt: r.e.startsAt.getTime(),
    allDay: r.e.allDay, done: r.e.done, linkedSessionType: r.e.linkedSessionType, courseId: r.e.courseId,
    course: r.c ? { name: r.c.name, color: r.c.color, slug: r.c.slug } : null,
  };
}

function toClass(r: ReturnType<typeof getCelcatDay>[number]): ClassItemData {
  return {
    id: r.e.id, subject: r.e.subject, sessionType: r.e.sessionType, category: r.e.category,
    start: r.e.start.getTime(), end: r.e.end.getTime(), room: r.e.room, teacher: r.e.teacher, cancelled: r.e.cancelled,
    course: r.c ? { name: r.c.name, color: r.c.color, slug: r.c.slug } : null,
  };
}

function greeting(h: number) {
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

export default async function Dashboard() {
  await ensureInitialSync();
  const now = new Date();
  const today = dayKey(now);
  const tomorrow = addDaysKey(today, 1);

  const courses = getCourseOptions();
  const todaySessions = getSessionsForDay(today).map(toSession);
  const tomorrowSessions = getSessionsForDay(tomorrow).map(toSession);
  const events = [...getOverdueEvents(now), ...getUpcomingEvents(7, now)].map(toEvent);
  const todayClasses = getCelcatDay(today).map(toClass);
  const remainingToday = todayClasses.filter((c) => c.end > now.getTime() && !c.cancelled);
  const nextDay = remainingToday.length ? null : getNextCourseDay(now);
  const nextDayClasses = nextDay ? getCelcatDay(nextDay).map(toClass) : [];
  const exams = getExams({ upcomingOnly: true }).slice(0, 6);
  const doneToday = todaySessions.filter((s) => s.done).length;

  return (
    <>
      <PageHeader
        title={`${greeting(now.getHours())} 👋`}
        subtitle={capitalize(fmtDayLong(now))}
        actions={
          <>
            <SyncButton compact />
            <QuickActions courses={courses} />
          </>
        }
      />

      {isMockMode() && (
        <div className="mb-4 rounded-xl border border-tp/30 bg-tp/10 px-4 py-2.5 text-sm">
          <b>Mode démo</b> : emploi du temps fictif. Configure ton instance Celcat dans{" "}
          <Link href="/settings" className="font-medium text-primary underline">Paramètres</Link>.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              icon={<Flame />}
              title="Révisions d'aujourd'hui"
              subtitle={todaySessions.length ? `${doneToday}/${todaySessions.length} terminée${doneToday > 1 ? "s" : ""}` : undefined}
              action={todaySessions.length > 0 && doneToday === todaySessions.length ? <CheckCircle2 className="size-5 text-td" /> : null}
            />
            <CardContent>
              {todaySessions.length ? (
                <ul className="space-y-0.5">{todaySessions.map((s) => <SessionItem key={s.id} s={s} />)}</ul>
              ) : (
                <EmptyState>Rien à réviser aujourd&apos;hui 🎉</EmptyState>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader icon={<Sunrise />} title="Révisions de demain" subtitle={capitalize(fmt(fromDayKey(tomorrow), "EEEE d MMMM"))} />
              <CardContent>
                {tomorrowSessions.length ? (
                  <ul className="space-y-0.5">{tomorrowSessions.map((s) => <SessionItem key={s.id} s={s} />)}</ul>
                ) : (
                  <EmptyState>Aucune révision prévue demain</EmptyState>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader icon={<ClipboardList />} title="Devoirs & événements" subtitle="7 prochains jours" />
              <CardContent>
                <EventList events={events} courses={courses} empty="Aucun devoir à venir" />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              icon={<CalendarClock />}
              title={remainingToday.length ? "Cours du jour" : nextDay ? `Prochains cours` : "Cours"}
              subtitle={!remainingToday.length && nextDay ? capitalize(fmt(fromDayKey(nextDay), "EEEE d MMMM")) : undefined}
              action={<Link href="/calendar" className="text-xs font-medium text-primary">Calendrier</Link>}
            />
            <CardContent>
              {remainingToday.length ? (
                <LiveClasses classes={todayClasses} />
              ) : nextDayClasses.length ? (
                <>
                  {todayClasses.length > 0 && <p className="mb-2 text-xs text-muted-foreground">Journée de cours terminée ✓</p>}
                  <LiveClasses classes={nextDayClasses} />
                </>
              ) : (
                <EmptyState>Aucun cours à venir</EmptyState>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader icon={<GraduationCap />} title="Prochains partiels" action={<Link href="/exams" className="text-xs font-medium text-primary">Tout voir</Link>} />
            <CardContent>
              {exams.length ? (
                <ul className="space-y-3">
                  {exams.map(({ exam, course, total, done }) => {
                    const d = daysUntil(exam.startsAt, now);
                    const pct = total ? Math.round((done / total) * 100) : 0;
                    return (
                      <li key={exam.id}>
                        <Link href="/exams" className="flex items-center gap-3">
                          <div
                            className="grid size-12 shrink-0 place-items-center rounded-xl text-center"
                            style={{ background: `${course.color}1f`, color: course.color }}
                          >
                            <span className="text-sm font-bold leading-none">{d <= 1 ? countdownLabel(exam.startsAt, now) : `J-${d}`}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{exam.title}</p>
                            <p className="text-[11px] text-muted-foreground">{fmtCap(exam.startsAt, "EEE d MMM 'à' HH'h'mm")}</p>
                            {total > 0 && (
                              <div className="mt-1 flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: course.color }} />
                                </div>
                                <span className="text-[10px] tabular-nums text-muted-foreground">{done}/{total}</span>
                              </div>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState icon={<AlarmClock />}>Aucun partiel planifié</EmptyState>
              )}
            </CardContent>
          </Card>

          {courses.length > 0 && (
            <Card>
              <CardHeader icon={<BookOpen />} title="Mes matières" action={<Link href="/courses" className="text-xs font-medium text-primary">Tout voir</Link>} />
              <CardContent className="flex flex-wrap gap-1.5">
                {courses.slice(0, 12).map((c) => (
                  <Link key={c.id} href={`/courses/${c.slug}`}>
                    <CourseBadge name={c.name} color={c.color} className="px-2 py-1 text-xs" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
