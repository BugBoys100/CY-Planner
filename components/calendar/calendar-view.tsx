"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  addDays, addMonths, addWeeks, endOfMonth, isSameDay, isSameMonth, startOfMonth, startOfWeek,
} from "date-fns";
import {
  CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Clock, FolderOpen, List, Loader2, MapPin, Plus, User, X,
} from "lucide-react";
import type { CalendarItem } from "@/lib/calendar";
import type { SessionType } from "@/lib/db/schema";
import { capitalize, fmt, fmtTime, fmtCap } from "@/lib/format";
import { cn, dayKey, hexToRgba } from "@/lib/utils";
import { toggleSession } from "@/app/actions";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { CourseBadge, TypeBadge } from "../ui/badge";
import { CheckCircle } from "../ui/checkbox";
import { EventDialog, KINDS, type CourseOption, type EventDraft } from "../event-dialog";

type View = "month" | "week" | "list";
type Layer = "CM" | "TDTP" | "AUTRE" | "revision" | "exam" | "event";

const LAYERS: { id: Layer; label: string; cls: string }[] = [
  { id: "CM", label: "CM", cls: "bg-cm" },
  { id: "TDTP", label: "TD / TP", cls: "bg-td" },
  { id: "AUTRE", label: "Autres cours", cls: "bg-autre" },
  { id: "revision", label: "Révisions", cls: "bg-revision" },
  { id: "exam", label: "Partiels", cls: "bg-exam" },
  { id: "event", label: "Devoirs & événements", cls: "bg-primary" },
];

const TYPE_VAR: Record<SessionType, string> = { CM: "var(--cm)", TD: "var(--td)", TP: "var(--tp)", AUTRE: "var(--autre)" };

function layerOf(i: CalendarItem): Layer {
  if (i.kind === "course") return i.sessionType === "CM" ? "CM" : i.sessionType === "AUTRE" ? "AUTRE" : "TDTP";
  return i.kind;
}

function accent(i: CalendarItem) {
  if (i.kind === "course" && /exam|partiel/i.test(i.category ?? "")) return "var(--exam)";
  if (i.kind === "course") return TYPE_VAR[i.sessionType ?? "AUTRE"];
  if (i.kind === "revision") return "var(--revision)";
  if (i.kind === "exam") return "var(--exam)";
  return i.color;
}

function itemLabel(i: CalendarItem) {
  if (i.kind === "revision") return `📚 ${i.courseName} · ${i.title}`;
  if (i.kind === "exam") return `🎯 ${i.title}`;
  if (i.kind === "event") return `${KINDS.find((k) => k.id === i.eventKind)?.emoji ?? "📌"} ${i.title}`;
  return i.title;
}

function computeRange(view: View, cursor: Date) {
  if (view === "month") {
    const from = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    return { from, to: addDays(from, 42) };
  }
  if (view === "list") {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    return { from, to: addDays(from, 14) };
  }
  const from = startOfWeek(cursor, { weekStartsOn: 1 });
  return { from, to: addDays(from, 7) };
}

export function CalendarView({ courses, exams }: { courses: CourseOption[]; exams: { id: number; title: string; color: string }[] }) {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<Layer>>(new Set());
  const [courseFilter, setCourseFilter] = useState<Set<number>>(new Set());
  const [examFilter, setExamFilter] = useState<number | null>(null);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [eventDialog, setEventDialog] = useState<{ open: boolean; initial?: EventDraft | null; courseId?: number | null; startsAt?: number }>({ open: false });
  const [version, setVersion] = useState(0);

  // Vue liste par défaut sur mobile
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setView("list");
  }, []);

  const range = useMemo(() => computeRange(view, cursor), [view, cursor]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/calendar?from=${range.from.getTime()}&to=${range.to.getTime()}`)
      .then((r) => r.json())
      .then((data: CalendarItem[]) => !cancelled && Array.isArray(data) && setItems(data))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const visible = useMemo(
    () =>
      items.filter((i) => {
        if (hidden.has(layerOf(i))) return false;
        if (courseFilter.size && (!i.courseId || !courseFilter.has(i.courseId))) return false;
        if (examFilter !== null && (i.kind === "revision" || i.kind === "exam") && i.examId !== examFilter) return false;
        if (examFilter !== null && i.kind !== "revision" && i.kind !== "exam") return false;
        return true;
      }),
    [items, hidden, courseFilter, examFilter],
  );

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const i of visible) {
      const k = dayKey(i.start);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(i);
    }
    return m;
  }, [visible]);

  const step = (dir: 1 | -1) =>
    setCursor((c) => (view === "month" ? addMonths(c, dir) : view === "week" ? addWeeks(c, dir) : addWeeks(c, 2 * dir)));

  const title =
    view === "month"
      ? capitalize(fmt(cursor, "MMMM yyyy"))
      : `${fmt(range.from, "d MMM")} – ${fmt(addDays(range.to, -1), "d MMM yyyy")}`;

  const toggleLayer = (l: Layer) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(l)) n.delete(l);
      else n.add(l);
      return n;
    });

  const courseIdsInRange = useMemo(() => new Set(items.map((i) => i.courseId).filter(Boolean) as number[]), [items]);

  function openItem(i: CalendarItem) {
    if (i.kind === "event") {
      setEventDialog({
        open: true,
        initial: {
          id: Number(i.refId), courseId: i.courseId, kind: i.eventKind ?? "autre", title: i.title,
          description: i.description ?? "", startsAt: i.start, allDay: i.allDay, linkedSessionType: i.sessionType ?? null,
        },
      });
    } else setSelected(i);
  }

  return (
    <div className="space-y-3">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => step(-1)} aria-label="Précédent"><ChevronLeft /></Button>
          <Button variant="outline" size="sm" onClick={() => { setCursor(new Date()); setSelectedDay(new Date()); }}>Aujourd&apos;hui</Button>
          <Button variant="outline" size="icon-sm" onClick={() => step(1)} aria-label="Suivant"><ChevronRight /></Button>
        </div>
        <h2 className="order-first w-full truncate text-base font-semibold md:order-none md:w-auto md:min-w-0 md:flex-1">
          {title} {loading && <Loader2 className="ml-1 inline size-3.5 animate-spin text-muted-foreground" />}
        </h2>
        <div className="flex rounded-lg border bg-card p-0.5">
          {([
            ["month", "Mois", CalendarDays],
            ["week", "Semaine", CalendarRange],
            ["list", "Liste", List],
          ] as const).map(([v, label, Icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setEventDialog({ open: true, startsAt: undefined })}>
          <Plus /> <span className="hidden sm:inline">Ajouter</span>
        </Button>
      </div>

      {/* Filtres */}
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {LAYERS.map((l) => (
          <button
            key={l.id}
            onClick={() => toggleLayer(l.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
              hidden.has(l.id) ? "text-muted-foreground opacity-60" : "bg-card",
            )}
          >
            <span className={cn("size-2 rounded-full", l.cls, hidden.has(l.id) && "opacity-30")} />
            {l.label}
          </button>
        ))}
      </div>
      {(courseIdsInRange.size > 0 || exams.length > 0) && (
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {exams.map((e) => (
            <button
              key={`x${e.id}`}
              onClick={() => setExamFilter((x) => (x === e.id ? null : e.id))}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                examFilter === e.id ? "border-exam bg-exam/10 text-exam" : "text-muted-foreground hover:bg-muted",
              )}
            >
              🎯 {e.title}
            </button>
          ))}
          {courses
            .filter((c) => courseIdsInRange.has(c.id) || courseFilter.has(c.id))
            .map((c) => {
              const on = courseFilter.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() =>
                    setCourseFilter((s) => {
                      const n = new Set(s);
                      if (on) n.delete(c.id);
                      else n.add(c.id);
                      return n;
                    })
                  }
                  className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", !on && "text-muted-foreground hover:bg-muted")}
                  style={on ? { background: hexToRgba(c.color, 0.15), borderColor: c.color, color: c.color } : undefined}
                >
                  {c.name}
                </button>
              );
            })}
          {(courseFilter.size > 0 || examFilter !== null) && (
            <button onClick={() => { setCourseFilter(new Set()); setExamFilter(null); }}
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="size-3" /> Réinitialiser
            </button>
          )}
        </div>
      )}

      {view === "month" && (
        <MonthGrid
          cursor={cursor} from={range.from} byDay={byDay} selectedDay={selectedDay}
          onSelectDay={setSelectedDay} onOpen={openItem}
        />
      )}
      {view === "month" && (
        <DayPanel
          day={selectedDay} items={byDay.get(dayKey(selectedDay)) ?? []} onOpen={openItem}
          onAdd={() => { const d = new Date(selectedDay); d.setHours(8, 30, 0, 0); setEventDialog({ open: true, startsAt: d.getTime() }); }}
        />
      )}
      {view === "week" && <WeekGrid from={range.from} items={visible} onOpen={openItem} />}
      {view === "list" && <ListView from={range.from} days={14} byDay={byDay} onOpen={openItem} />}

      <ItemDetails item={selected} onClose={() => setSelected(null)} onChanged={reload}
        onAddEvent={(i) => { setSelected(null); setEventDialog({ open: true, courseId: i.courseId }); }} />
      <EventDialog
        open={eventDialog.open}
        onClose={() => { setEventDialog({ open: false }); reload(); }}
        courses={courses}
        initial={eventDialog.initial}
        defaultCourseId={eventDialog.courseId}
        defaultStartsAt={eventDialog.startsAt}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

function Pill({ i, onOpen, compact }: { i: CalendarItem; onOpen: (i: CalendarItem) => void; compact?: boolean }) {
  const a = accent(i);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(i); }}
      className={cn(
        "flex w-full items-center gap-1 truncate rounded px-1 py-[1px] text-left text-[11px] leading-tight",
        i.kind === "revision" && "border border-dashed",
        (i.done || i.cancelled) && "line-through opacity-50",
      )}
      style={{ background: `color-mix(in srgb, ${a} 16%, transparent)`, borderColor: a, color: "inherit" }}
      title={itemLabel(i)}
    >
      {!compact && !i.allDay && <span className="shrink-0 tabular-nums text-muted-foreground">{fmtTime(i.start)}</span>}
      <span className="truncate">{itemLabel(i)}</span>
    </button>
  );
}

function MonthGrid({
  cursor, from, byDay, selectedDay, onSelectDay, onOpen,
}: {
  cursor: Date; from: Date; byDay: Map<string, CalendarItem[]>; selectedDay: Date;
  onSelectDay: (d: Date) => void; onOpen: (i: CalendarItem) => void;
}) {
  const days = Array.from({ length: 42 }, (_, k) => addDays(from, k));
  const today = new Date();
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-medium text-muted-foreground">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => <div key={d} className="py-1.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(dayKey(d)) ?? [];
          const isSel = isSameDay(d, selectedDay);
          return (
            <div
              key={d.toISOString()}
              onClick={() => onSelectDay(d)}
              className={cn(
                "min-h-14 cursor-pointer border-r border-b p-1 transition-colors last:border-r-0 md:min-h-28 [&:nth-child(7n)]:border-r-0",
                !isSameMonth(d, cursor) && "bg-muted/30 text-muted-foreground",
                isSel && "bg-accent/60",
              )}
            >
              <div className="mb-0.5 flex justify-center md:justify-start">
                <span className={cn("grid size-6 place-items-center rounded-full text-xs", isSameDay(d, today) && "bg-primary font-bold text-primary-foreground")}>
                  {d.getDate()}
                </span>
              </div>
              <div className="hidden space-y-0.5 md:block">
                {list.slice(0, 4).map((i) => <Pill key={i.id} i={i} onOpen={onOpen} />)}
                {list.length > 4 && <p className="px-1 text-[10px] text-muted-foreground">+{list.length - 4} autres</p>}
              </div>
              <div className="flex flex-wrap justify-center gap-0.5 md:hidden">
                {list.slice(0, 6).map((i) => <span key={i.id} className="size-1.5 rounded-full" style={{ background: accent(i) }} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayPanel({ day, items, onOpen, onAdd }: { day: Date; items: CalendarItem[]; onOpen: (i: CalendarItem) => void; onAdd: () => void }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{fmtCap(day, "EEEE d MMMM")}</h3>
        <Button size="sm" variant="ghost" onClick={onAdd}><Plus /> Ajouter</Button>
      </div>
      {items.length ? <AgendaRows items={items} onOpen={onOpen} /> : <p className="py-3 text-center text-sm text-muted-foreground">Rien ce jour-là</p>}
    </div>
  );
}

function AgendaRows({ items, onOpen }: { items: CalendarItem[]; onOpen: (i: CalendarItem) => void }) {
  return (
    <ul className="space-y-1.5">
      {items.map((i) => {
        const a = accent(i);
        return (
          <li key={i.id}>
            <button
              onClick={() => onOpen(i)}
              className={cn(
                "relative flex w-full items-stretch gap-3 overflow-hidden rounded-lg border p-2 pl-3 text-left transition-colors hover:bg-muted/60",
                i.kind === "revision" && "border-dashed",
                (i.done || i.cancelled) && "opacity-55",
              )}
              style={{ background: `color-mix(in srgb, ${a} 7%, var(--card))` }}
            >
              <span className="absolute inset-y-0 left-0 w-1" style={{ background: a }} />
              <div className="w-11 shrink-0 text-[11px] tabular-nums leading-tight">
                {i.allDay ? <span className="text-muted-foreground">Journée</span> : (
                  <>
                    <p className="font-semibold">{fmtTime(i.start)}</p>
                    {i.kind !== "event" && <p className="text-muted-foreground">{fmtTime(i.end)}</p>}
                  </>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  {i.kind === "course" && <TypeBadge type={i.sessionType ?? "AUTRE"} label={i.sessionType === "AUTRE" ? i.category : undefined} />}
                  {i.cancelled && <span className="text-[10px] font-semibold uppercase tracking-wide text-exam">Annulé</span>}
                  {i.kind === "revision" && <span className="text-[10px] font-semibold uppercase tracking-wide text-revision">Révision</span>}
                  {i.kind === "exam" && <span className="text-[10px] font-semibold uppercase tracking-wide text-exam">Partiel</span>}
                  {i.kind === "event" && i.sessionType && <TypeBadge type={i.sessionType} />}
                </div>
                <p className={cn("truncate text-sm font-medium", (i.done || i.cancelled) && "line-through")}>{i.kind === "course" ? i.title : itemLabel(i)}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {i.kind === "course" ? [i.room, i.teacher].filter(Boolean).join(" · ") : i.courseName ?? ""}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ListView({ from, days, byDay, onOpen }: { from: Date; days: number; byDay: Map<string, CalendarItem[]>; onOpen: (i: CalendarItem) => void }) {
  const today = new Date();
  const list = Array.from({ length: days }, (_, k) => addDays(from, k)).filter(
    (d) => (byDay.get(dayKey(d))?.length ?? 0) > 0 || isSameDay(d, today),
  );
  if (!list.length) return <p className="py-10 text-center text-sm text-muted-foreground">Rien sur cette période</p>;
  return (
    <div className="space-y-4">
      {list.map((d) => {
        const items = byDay.get(dayKey(d)) ?? [];
        const isToday = isSameDay(d, today);
        return (
          <section key={d.toISOString()}>
            <h3 className={cn("sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-1 mb-1.5 bg-background/90 px-1 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur md:top-0", isToday ? "text-primary" : "text-muted-foreground")}>
              {isToday ? "Aujourd'hui · " : ""}{fmt(d, "EEEE d MMMM")}
            </h3>
            {items.length ? <AgendaRows items={items} onOpen={onOpen} /> : <p className="text-sm text-muted-foreground">Rien de prévu</p>}
          </section>
        );
      })}
    </div>
  );
}

function WeekGrid({ from, items, onOpen }: { from: Date; items: CalendarItem[]; onOpen: (i: CalendarItem) => void }) {
  const hasWeekend = items.some((i) => [0, 6].includes(new Date(i.start).getDay()));
  const nDays = hasWeekend ? 7 : 5;
  const days = Array.from({ length: nDays }, (_, k) => addDays(from, k));
  const timed = items.filter((i) => !i.allDay);
  const allDay = items.filter((i) => i.allDay);
  const minH = Math.min(8, ...timed.map((i) => new Date(i.start).getHours()));
  const maxH = Math.max(19, ...timed.map((i) => Math.ceil(new Date(i.end).getHours() + new Date(i.end).getMinutes() / 60)));
  const hours = Array.from({ length: maxH - minH }, (_, k) => minH + k);
  const PX = 52; // px par heure
  const now = new Date();

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="min-w-[640px]">
        <div className="grid border-b" style={{ gridTemplateColumns: `3rem repeat(${nDays}, 1fr)` }}>
          <div />
          {days.map((d) => (
            <div key={d.toISOString()} className={cn("border-l py-2 text-center", isSameDay(d, now) && "text-primary")}>
              <p className="text-[11px] uppercase text-muted-foreground">{fmt(d, "EEE")}</p>
              <p className={cn("mx-auto grid size-7 place-items-center rounded-full text-sm font-semibold", isSameDay(d, now) && "bg-primary text-primary-foreground")}>{d.getDate()}</p>
            </div>
          ))}
        </div>
        {allDay.length > 0 && (
          <div className="grid border-b" style={{ gridTemplateColumns: `3rem repeat(${nDays}, 1fr)` }}>
            <div className="py-1 text-center text-[10px] text-muted-foreground">jour</div>
            {days.map((d) => (
              <div key={d.toISOString()} className="space-y-0.5 border-l p-0.5">
                {allDay.filter((i) => isSameDay(i.start, d)).map((i) => <Pill key={i.id} i={i} onOpen={onOpen} compact />)}
              </div>
            ))}
          </div>
        )}
        <div className="relative grid" style={{ gridTemplateColumns: `3rem repeat(${nDays}, 1fr)` }}>
          <div>
            {hours.map((h) => (
              <div key={h} className="relative text-right text-[10px] text-muted-foreground" style={{ height: PX }}>
                <span className="absolute -top-1.5 right-1.5">{h}h</span>
              </div>
            ))}
          </div>
          {days.map((d) => {
            const dayItems = layoutLanes(timed.filter((i) => isSameDay(i.start, d)));
            const isToday = isSameDay(d, now);
            return (
              <div key={d.toISOString()} className="relative border-l">
                {hours.map((h) => <div key={h} className="border-b border-dashed border-border/60" style={{ height: PX }} />)}
                {isToday && now.getHours() >= minH && now.getHours() < maxH && (
                  <div className="absolute inset-x-0 z-10 h-0.5 bg-exam" style={{ top: ((now.getHours() - minH) * 60 + now.getMinutes()) * (PX / 60) }}>
                    <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-exam" />
                  </div>
                )}
                {dayItems.map(({ item: i, lane, lanes }) => {
                  const s = new Date(i.start);
                  const top = ((s.getHours() - minH) * 60 + s.getMinutes()) * (PX / 60);
                  const h = Math.max(20, ((i.end - i.start) / 60000) * (PX / 60) - 2);
                  const a = accent(i);
                  return (
                    <button
                      key={i.id}
                      onClick={() => onOpen(i)}
                      className={cn(
                        "absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm transition-transform hover:z-20 hover:scale-[1.02]",
                        i.kind === "revision" && "border border-dashed border-l-[3px]",
                        (i.done || i.cancelled) && "opacity-50 line-through",
                      )}
                      style={{
                        top, height: h,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)`,
                        background: `color-mix(in srgb, ${a} 16%, var(--card))`, borderColor: a,
                      }}
                    >
                      <p className="truncate font-semibold">
                        {i.kind === "course" && <span style={{ color: a }}>{i.sessionType === "AUTRE" ? i.category : i.sessionType} </span>}
                        {i.kind === "course" ? i.title : itemLabel(i)}
                      </p>
                      {h > 34 && <p className="truncate text-muted-foreground">{fmtTime(i.start)}{i.kind !== "event" && `–${fmtTime(i.end)}`}</p>}
                      {h > 50 && i.room && <p className="truncate text-muted-foreground">{i.room}</p>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Répartit les événements qui se chevauchent sur plusieurs colonnes */
function layoutLanes(items: CalendarItem[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: { item: CalendarItem; lane: number; lanes: number }[] = [];
  let cluster: { item: CalendarItem; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const c of cluster) out.push({ ...c, lanes });
    cluster = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    const end = Math.max(item.end, item.start + 20 * 60000);
    if (item.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else laneEnds[lane] = end;
    cluster.push({ item, lane });
    clusterEnd = Math.max(clusterEnd === -Infinity ? end : clusterEnd, end);
  }
  flush();
  return out;
}

function ItemDetails({
  item, onClose, onChanged, onAddEvent,
}: { item: CalendarItem | null; onClose: () => void; onChanged: () => void; onAddEvent: (i: CalendarItem) => void }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  useEffect(() => setDone(!!item?.done), [item]);
  if (!item) return null;
  const a = accent(item);
  return (
    <Dialog
      open={!!item}
      onClose={onClose}
      size="sm"
      title={<span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: a }} />{item.kind === "course" ? item.title : itemLabel(item)}</span>}
      description={capitalize(fmt(item.start, "EEEE d MMMM yyyy"))}
    >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.kind === "course" && <TypeBadge type={item.sessionType ?? "AUTRE"} label={item.sessionType === "AUTRE" ? item.category : undefined} />}
          {item.cancelled && <span className="rounded-md bg-exam/10 px-1.5 py-0.5 text-[11px] font-semibold text-exam">Séance annulée</span>}
          {item.courseName && <CourseBadge name={item.courseName} color={item.color} />}
          {item.examTitle && item.kind === "revision" && <span className="text-xs text-muted-foreground">→ {item.examTitle}</span>}
        </div>
        <ul className="space-y-1.5 text-muted-foreground">
          {!item.allDay && <li className="flex items-center gap-2"><Clock className="size-4" />{fmtTime(item.start)} – {fmtTime(item.end)}</li>}
          {item.room && <li className="flex items-center gap-2"><MapPin className="size-4" />{item.room}</li>}
          {item.teacher && <li className="flex items-center gap-2"><User className="size-4" />{item.teacher}</li>}
        </ul>
        {item.description && <p className="whitespace-pre-wrap rounded-lg bg-muted p-2.5">{item.description}</p>}

        {item.kind === "revision" && (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-2.5">
            <CheckCircle
              checked={done}
              color={item.color}
              disabled={pending}
              onChange={(v) => start(async () => { setDone(v); await toggleSession(Number(item.refId), v); onChanged(); })}
            />
            <span>{done ? "Session terminée ✓" : "Marquer la session comme terminée"}</span>
          </label>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {item.courseSlug && (
            <Link href={`/courses/${item.courseSlug}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium hover:bg-muted">
              <FolderOpen className="size-3.5" /> Espace de la matière
            </Link>
          )}
          {item.kind === "course" && (
            <Button size="sm" onClick={() => onAddEvent(item)}><Plus /> Devoir pour cette matière</Button>
          )}
          {(item.kind === "exam" || item.kind === "revision") && (
            <Link href="/exams" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium hover:bg-muted">
              Gérer le partiel
            </Link>
          )}
        </div>
      </div>
    </Dialog>
  );
}
