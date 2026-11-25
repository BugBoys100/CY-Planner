"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { Clock, FolderOpen, MapPin, User } from "lucide-react";
import { toggleEvent, toggleSession } from "@/app/actions";
import type { EventKind, SessionType } from "@/lib/db/schema";
import { fmt, fmtTime, fmtCap } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CheckCircle } from "./ui/checkbox";
import { CourseBadge, TYPE_BAR, TypeBadge } from "./ui/badge";
import { KINDS } from "./event-dialog";

export interface SessionItemData {
  id: number;
  title: string;
  description: string;
  startTime: string | null;
  durationMinutes: number;
  done: boolean;
  examTitle: string;
  course: { name: string; color: string; slug: string };
}

export function SessionItem({ s }: { s: SessionItemData }) {
  const [, start] = useTransition();
  const [done, setDone] = useOptimistic(s.done);
  return (
    <li className={cn("flex items-start gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-muted/60", done && "opacity-60")}>
      <div className="pt-0.5">
        <CheckCircle checked={done} color={s.course.color} onChange={(v) => start(async () => { setDone(v); await toggleSession(s.id, v); })} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", done && "line-through")}>{s.title}</p>
        {s.description && <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <CourseBadge name={s.course.name} color={s.course.color} />
          {s.startTime && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3" /> {s.startTime.replace(":", "h")} · {s.durationMinutes} min
            </span>
          )}
          <span className="truncate text-[11px] text-muted-foreground">→ {s.examTitle}</span>
        </div>
      </div>
      <Link href={`/courses/${s.course.slug}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-card hover:text-foreground" aria-label="Ouvrir la matière">
        <FolderOpen className="size-4" />
      </Link>
    </li>
  );
}

export interface EventItemData {
  id: number;
  title: string;
  description: string;
  kind: EventKind;
  startsAt: number;
  allDay: boolean;
  done: boolean;
  linkedSessionType: SessionType | null;
  course: { name: string; color: string; slug: string } | null;
}

export function EventItem({ e, onOpen, showDate = true }: { e: EventItemData; onOpen?: () => void; showDate?: boolean }) {
  const [, start] = useTransition();
  const [done, setDone] = useOptimistic(e.done);
  const kind = KINDS.find((k) => k.id === e.kind);
  return (
    <li
      className={cn("flex cursor-pointer items-start gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-muted/60", done && "opacity-60")}
      onClick={onOpen}
    >
      <div className="pt-0.5">
        <CheckCircle checked={done} color={e.course?.color} onChange={(v) => start(async () => { setDone(v); await toggleEvent(e.id, v); })} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", done && "line-through")}>
          <span className="mr-1">{kind?.emoji}</span>
          {e.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {e.course && <CourseBadge name={e.course.name} color={e.course.color} />}
          {e.linkedSessionType && <TypeBadge type={e.linkedSessionType} />}
          {showDate && (
            <span className="text-[11px] text-muted-foreground">
              {fmtCap(e.startsAt, "EEE d MMM")}
              {!e.allDay && ` · ${fmtTime(e.startsAt)}`}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export interface ClassItemData {
  id: string;
  subject: string;
  sessionType: SessionType;
  category: string;
  start: number;
  end: number;
  room: string;
  teacher: string;
  cancelled?: boolean;
  course: { name: string; color: string; slug: string } | null;
}

export function ClassItem({ c, now }: { c: ClassItemData; now: number }) {
  const ongoing = !c.cancelled && c.start <= now && now < c.end;
  const past = c.end <= now;
  const progress = ongoing ? ((now - c.start) / (c.end - c.start)) * 100 : 0;
  const inner = (
    <div className={cn("relative flex gap-3 overflow-hidden rounded-lg border bg-card p-2.5 pl-3.5 transition-colors", (past || c.cancelled) && "opacity-50", ongoing && "border-primary/50 ring-1 ring-primary/30")}>
      <span className={cn("absolute inset-y-0 left-0 w-1", TYPE_BAR[c.sessionType])} />
      <div className="w-12 shrink-0 text-xs tabular-nums">
        <p className="font-semibold">{fmtTime(c.start)}</p>
        <p className="text-muted-foreground">{fmtTime(c.end)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <TypeBadge type={c.sessionType} label={c.sessionType === "AUTRE" ? c.category : undefined} />
          {ongoing && <span className="text-[11px] font-semibold text-primary">En cours</span>}
          {c.cancelled && <span className="text-[11px] font-semibold text-exam">Annulé</span>}
        </div>
        <p className={cn("mt-0.5 truncate text-sm font-medium", c.cancelled && "line-through")}>{c.subject}</p>
        <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
          {c.room && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{c.room}</span>}
          {c.teacher && <span className="inline-flex items-center gap-1"><User className="size-3" />{c.teacher}</span>}
        </div>
      </div>
      {ongoing && <span className="absolute bottom-0 left-0 h-0.5 bg-primary" style={{ width: `${progress}%` }} />}
    </div>
  );
  return c.course ? <Link href={`/courses/${c.course.slug}`}>{inner}</Link> : inner;
}
