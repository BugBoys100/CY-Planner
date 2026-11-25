"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, ChevronDown, Clock, FolderOpen, GraduationCap, MapPin, Pencil, Plus } from "lucide-react";
import { toggleSession } from "@/app/actions";
import type { RevisionLevel } from "@/lib/db/schema";
import { LEVELS } from "@/lib/revision";
import { capitalize, countdownLabel, daysUntil, fmt, fmtCap } from "@/lib/format";
import { cn, dayKey, fromDayKey, hexToRgba } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card, EmptyState } from "../ui/card";
import { CheckCircle } from "../ui/checkbox";
import { ExamDialog, type ExamDraft } from "../exam-dialog";
import type { CourseOption } from "../event-dialog";

export interface ExamCardData {
  id: number;
  title: string;
  startsAt: number;
  durationMinutes: number;
  location: string;
  revisionLevel: RevisionLevel;
  revisionPercent: number;
  fromCelcat?: boolean;
  course: CourseOption;
  sessions: { id: number; date: string; startTime: string | null; durationMinutes: number; title: string; description: string; done: boolean }[];
}

export function ExamsBoard({ exams, courses }: { exams: ExamCardData[]; courses: CourseOption[] }) {
  const [dialog, setDialog] = useState<{ open: boolean; initial?: ExamDraft | null }>({ open: false });
  const now = Date.now();
  const upcoming = exams.filter((e) => e.startsAt + e.durationMinutes * 60_000 > now);
  const past = exams.filter((e) => e.startsAt + e.durationMinutes * 60_000 <= now).reverse();

  const edit = (e: ExamCardData) =>
    setDialog({
      open: true,
      initial: {
        id: e.id, courseId: e.course.id, title: e.title, startsAt: e.startsAt, durationMinutes: e.durationMinutes,
        location: e.location, revisionLevel: e.revisionLevel, revisionPercent: e.revisionPercent,
        sessions: e.sessions.map((s) => ({ ...s, key: `db${s.id}` })),
      },
    });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialog({ open: true, initial: null })} disabled={!courses.length}>
          <Plus /> Nouveau partiel
        </Button>
      </div>

      {upcoming.length === 0 ? (
        <EmptyState icon={<GraduationCap />}>
          Aucun partiel à venir.
          <button className="font-medium text-primary" onClick={() => setDialog({ open: true, initial: null })}>Planifier un partiel →</button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {upcoming.map((e) => <ExamCard key={e.id} exam={e} onEdit={() => edit(e)} />)}
        </div>
      )}

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Partiels passés ({past.length})</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 opacity-75 xl:grid-cols-2">
            {past.map((e) => <ExamCard key={e.id} exam={e} onEdit={() => edit(e)} compact />)}
          </div>
        </details>
      )}

      <ExamDialog open={dialog.open} onClose={() => setDialog({ open: false })} courses={courses} initial={dialog.initial} />
    </>
  );
}

function ExamCard({ exam, onEdit, compact }: { exam: ExamCardData; onEdit: () => void; compact?: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const today = dayKey(new Date());
  const done = exam.sessions.filter((s) => s.done).length;
  const total = exam.sessions.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const d = daysUntil(exam.startsAt);
  const late = exam.sessions.filter((s) => !s.done && s.date < today).length;
  const futureFirst = exam.sessions.findIndex((s) => s.date >= today);
  const from = futureFirst === -1 ? Math.max(0, exam.sessions.length - 4) : Math.max(0, futureFirst - 1);
  const visible = showAll ? exam.sessions : exam.sessions.slice(from, from + 5);
  const level = LEVELS.find((l) => l.id === exam.revisionLevel);
  const c = exam.course.color;

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-4 p-4" style={{ background: `linear-gradient(135deg, ${hexToRgba(c, 0.12)}, transparent 70%)` }}>
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl text-center shadow-sm" style={{ background: c, color: "white" }}>
          <div>
            <p className="text-xl font-extrabold leading-none">{d > 1 ? d : countdownLabel(exam.startsAt) === "passé" ? "✓" : "!"}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase opacity-90">{d > 1 ? "jours" : countdownLabel(exam.startsAt)}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 font-semibold">
                <span className="truncate">{exam.title}</span>
                {exam.fromCelcat && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title="Importé depuis Celcat : la date suit l'emploi du temps">Celcat</span>}
              </h3>
              <Link href={`/courses/${exam.course.slug}`} className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: c }}>
                <FolderOpen className="size-3" /> {exam.course.name}
              </Link>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label="Modifier"><Pencil /></Button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" />{fmtCap(exam.startsAt, "EEEE d MMMM 'à' HH'h'mm")}</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{Math.floor(exam.durationMinutes / 60)}h{String(exam.durationMinutes % 60).padStart(2, "0")}</span>
            {exam.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{exam.location}</span>}
          </div>
        </div>
      </div>

      {!compact && (
        <div className="px-4 pb-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Révisions : <b className="text-foreground">{done}/{total}</b> · niveau {level?.label.toLowerCase()} ({exam.revisionPercent} %)
              {late > 0 && <span className="ml-1 font-medium text-exam">· {late} en retard</span>}
            </span>
            <span className="font-semibold tabular-nums">{pct} %</span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c }} />
          </div>
          {total > 0 ? (
            <ul className="space-y-0.5">
              {visible.map((s) => <SessionRow key={s.id} s={s} color={c} today={today} />)}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune session de révision.</p>
          )}
          {total > visible.length && (
            <button onClick={() => setShowAll(true)} className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
              <ChevronDown className="size-3.5" /> Voir les {total} sessions
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

function SessionRow({ s, color, today }: { s: ExamCardData["sessions"][number]; color: string; today: string }) {
  const [, start] = useTransition();
  const [done, setDone] = useState(s.done);
  const isToday = s.date === today;
  const late = !done && s.date < today;
  return (
    <li className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2", isToday && "bg-accent/60", done && "opacity-55")}>
      <CheckCircle checked={done} color={color} onChange={(v) => { setDone(v); start(() => toggleSession(s.id, v)); }} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", done && "line-through")}>{s.title}</p>
        <p className={cn("text-[11px] text-muted-foreground", late && "text-exam")}>
          {isToday ? "Aujourd'hui" : capitalize(fmtCap(fromDayKey(s.date), "EEE d MMM"))}
          {s.startTime && ` · ${s.startTime.replace(":", "h")}`}
          {late && " · en retard"}
        </p>
      </div>
    </li>
  );
}
