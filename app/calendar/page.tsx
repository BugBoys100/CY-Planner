import { PageHeader } from "@/components/page-header";
import { SyncButton } from "@/components/sync-button";
import { CalendarView } from "@/components/calendar/calendar-view";
import { getCourseOptions, getExams } from "@/lib/queries";
import { ensureInitialSync } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendrier" };

export default async function CalendarPage() {
  await ensureInitialSync();
  const courses = getCourseOptions();
  const exams = getExams({ upcomingOnly: true }).map(({ exam, course }) => ({ id: exam.id, title: exam.title, color: course.color }));
  return (
    <>
      <PageHeader title="Calendrier" subtitle="Cours, révisions, partiels et devoirs" actions={<SyncButton compact />} />
      <CalendarView courses={courses} exams={exams} />
    </>
  );
}
