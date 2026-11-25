import { PageHeader } from "@/components/page-header";
import { ExamsBoard, type ExamCardData } from "@/components/exams/exams-board";
import { getCourseOptions, getExamSessions, getExams } from "@/lib/queries";
import { ensureInitialSync } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partiels" };

export default async function ExamsPage() {
  await ensureInitialSync();
  const courses = getCourseOptions();
  const exams: ExamCardData[] = getExams().map(({ exam, course }) => ({
    id: exam.id,
    title: exam.title,
    startsAt: exam.startsAt.getTime(),
    durationMinutes: exam.durationMinutes,
    location: exam.location,
    revisionLevel: exam.revisionLevel,
    revisionPercent: exam.revisionPercent,
    fromCelcat: !!exam.celcatEventId,
    course: { id: course.id, name: course.name, color: course.color, slug: course.slug },
    sessions: getExamSessions(exam.id).map((s) => ({
      id: s.id, date: s.date, startTime: s.startTime, durationMinutes: s.durationMinutes,
      title: s.title, description: s.description, done: s.done,
    })),
  }));
  return (
    <>
      <PageHeader title="Partiels & révisions" subtitle="Planifie tes révisions automatiquement" />
      <ExamsBoard exams={exams} courses={courses} />
    </>
  );
}
