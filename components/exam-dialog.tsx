"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CalendarRange, ChevronDown, Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import { createExam, deleteExam, updateExam, type SessionInput } from "@/app/actions";
import type { RevisionLevel } from "@/lib/db/schema";
import {
  LEVELS, candidateDays, generateSessions, newKey, percentForLevel, sortSessions, type DraftSession,
} from "@/lib/revision";
import { fmt, fmtCap } from "@/lib/format";
import { addDaysKey, cn, dayKey, fromDayKey, toDatetimeLocal } from "@/lib/utils";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/input";
import { useToast } from "./ui/toast";
import type { CourseOption } from "./event-dialog";

export interface ExamDraft {
  id?: number;
  courseId: number | null;
  title: string;
  startsAt: number;
  durationMinutes: number;
  location: string;
  revisionLevel: RevisionLevel;
  revisionPercent: number;
  sessions: (DraftSession & { id?: number; done?: boolean })[];
}

type Row = ExamDraft["sessions"][number];

function defaultExamDate() {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

export function ExamDialog({
  open, onClose, courses, initial, defaultCourseId,
}: {
  open: boolean;
  onClose: () => void;
  courses: CourseOption[];
  initial?: ExamDraft | null;
  defaultCourseId?: number | null;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [courseId, setCourseId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [startsAt, setStartsAt] = useState(defaultExamDate());
  const [duration, setDuration] = useState(120);
  const [location, setLocation] = useState("");
  const [level, setLevel] = useState<RevisionLevel>("medium");
  const [customPct, setCustomPct] = useState(60);
  const [defaultTime, setDefaultTime] = useState("18:00");
  const [sessions, setSessions] = useState<Row[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Initialisation à l'ouverture
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setCourseId(initial.courseId);
      setTitle(initial.title);
      setTitleTouched(true);
      setStartsAt(initial.startsAt);
      setDuration(initial.durationMinutes);
      setLocation(initial.location);
      setLevel(initial.revisionLevel);
      setCustomPct(initial.revisionLevel === "custom" ? initial.revisionPercent : 60);
      setSessions(initial.sessions);
      setDefaultTime(initial.sessions.find((s) => s.startTime)?.startTime ?? "18:00");
    } else {
      setCourseId(defaultCourseId ?? courses[0]?.id ?? null);
      setTitle("");
      setTitleTouched(false);
      setStartsAt(defaultExamDate());
      setDuration(120);
      setLocation("");
      setLevel("medium");
      setCustomPct(60);
      setDefaultTime("18:00");
      setSessions(generateSessions({ examAt: new Date(defaultExamDate()), percent: 50, startTime: "18:00" }));
    }
    setExpanded(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const percent = percentForLevel(level, customPct);
  const examDate = useMemo(() => new Date(startsAt), [startsAt]);
  const course = courses.find((c) => c.id === courseId);
  const available = useMemo(() => candidateDays(examDate).length, [examDate]);

  // Prévisualisation instantanée : chaque changement de niveau / % / date / heure régénère la liste
  function regen(next: { startsAt?: number; level?: RevisionLevel; customPct?: number; defaultTime?: string }) {
    const sa = next.startsAt ?? startsAt;
    const pct = percentForLevel(next.level ?? level, next.customPct ?? customPct);
    setSessions(generateSessions({ examAt: new Date(sa), percent: pct, startTime: next.defaultTime ?? defaultTime }));
  }

  // Titre automatique tant que l'utilisateur ne l'a pas modifié
  useEffect(() => {
    if (!titleTouched) setTitle(course ? `Partiel de ${course.name}` : "");
  }, [course, titleTouched]);

  const firstDay = dayKey(new Date());
  const lastDay = addDaysKey(dayKey(examDate), -1);

  function patch(key: string, p: Partial<Row>) {
    setSessions((s) => {
      const next = s.map((x) => (x.key === key ? { ...x, ...p } : x));
      return p.date ? sortSessions(next) : next;
    });
  }

  function addSession() {
    const used = new Set(sessions.map((s) => s.date));
    let date = lastDay;
    for (let k = lastDay; k >= firstDay; k = addDaysKey(k, -1)) {
      if (!used.has(k)) {
        date = k;
        break;
      }
    }
    if (lastDay < firstDay) date = firstDay;
    const key = newKey();
    setSessions((s) => sortSessions([...s, { key, date, startTime: defaultTime, durationMinutes: 90, title: "Révision", description: "" }]));
    setExpanded(key);
  }

  function save() {
    if (!courseId) return toast("Choisis une matière", "error");
    if (startsAt <= Date.now() && !initial) return toast("La date du partiel doit être dans le futur", "error");
    const payload = {
      courseId,
      title: title || `Partiel de ${course?.name ?? ""}`,
      startsAt,
      durationMinutes: duration,
      location,
      revisionLevel: level,
      revisionPercent: percent,
      sessions: sessions.map<SessionInput>((s) => ({
        date: s.date, startTime: s.startTime, durationMinutes: s.durationMinutes,
        title: s.title, description: s.description, done: s.done,
      })),
    };
    start(async () => {
      try {
        if (initial?.id) await updateExam(initial.id, payload);
        else await createExam(payload);
        toast(`${initial?.id ? "Partiel mis à jour" : "Partiel créé"} · ${sessions.length} session(s) de révision`);
        onClose();
      } catch (e) {
        toast((e as Error).message, "error");
      }
    });
  }

  function remove() {
    if (!initial?.id || !confirm("Supprimer ce partiel et toutes ses sessions de révision ?")) return;
    start(async () => {
      await deleteExam(initial.id!);
      toast("Partiel supprimé");
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={initial?.id ? "Modifier le partiel" : "Nouveau partiel"}
      description="Les sessions de révision se mettent à jour en direct."
      footer={
        <>
          {initial?.id && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={remove} disabled={pending}>
              <Trash2 /> <span className="hidden sm:inline">Supprimer</span>
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={pending || !courseId}>
            {pending && <Loader2 className="animate-spin" />}
            {initial?.id ? "Enregistrer" : `Créer${sessions.length ? ` + ${sessions.length} révision${sessions.length > 1 ? "s" : ""}` : ""}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Matière">
            <Select value={courseId ?? ""} onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : null)}>
              {!courseId && <option value="">Choisir…</option>}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Titre">
            <Input value={title} onChange={(e) => { setTitleTouched(true); setTitle(e.target.value); }} placeholder="Partiel d'algorithmique" />
          </Field>
          <Field label="Date et heure du partiel">
            <Input type="datetime-local" value={toDatetimeLocal(startsAt)} min={toDatetimeLocal(Date.now())}
              onChange={(e) => {
                if (!e.target.value) return;
                const v = new Date(e.target.value).getTime();
                setStartsAt(v);
                regen({ startsAt: v });
              }} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Durée (min)">
              <Input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </Field>
            <Field label="Salle">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Amphi…" />
            </Field>
          </div>
        </div>

        {/* Niveau de révision */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Niveau de révision</p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => { setLevel(l.id); regen({ level: l.id }); }}
                className={cn(
                  "rounded-xl border px-2 py-2 text-left transition-all active:scale-[0.97]",
                  level === l.id ? "border-primary bg-accent ring-1 ring-primary" : "hover:bg-muted",
                )}
              >
                <span className="block text-sm font-semibold">{l.label}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {l.id === "custom" ? "1 – 100 %" : `${l.percent} %`}
                </span>
              </button>
            ))}
          </div>
          {level === "custom" && (
            <div className="mt-3 flex items-center gap-3">
              <input type="range" min={1} max={100} value={customPct} onChange={(e) => { const v = Number(e.target.value); setCustomPct(v); regen({ customPct: v }); }}
                className="flex-1 accent-[var(--primary)]" />
              <div className="flex items-center gap-1">
                <Input type="number" min={1} max={100} value={customPct} className="w-20 text-right"
                  onChange={(e) => { const v = Math.min(100, Math.max(1, Number(e.target.value) || 1)); setCustomPct(v); regen({ customPct: v }); }} />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">{LEVELS.find((l) => l.id === level)?.hint}</p>
        </div>

        {/* Prévisualisation éditable */}
        <div className="rounded-xl border bg-muted/40">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <CalendarRange className="size-4 text-revision" />
              <span className="font-semibold">{sessions.length} session{sessions.length > 1 ? "s" : ""}</span>
              <span className="text-muted-foreground">
                sur {available} jour{available > 1 ? "s" : ""} dispo · {percent} %
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Heure
                <input type="time" value={defaultTime} onChange={(e) => { if (!e.target.value) return; setDefaultTime(e.target.value); regen({ defaultTime: e.target.value }); }}
                  className="h-8 rounded-md border bg-card px-1.5 text-xs" />
              </label>
              {initial && (
                <Button size="sm" variant="ghost" title="Régénérer"
                  onClick={() => regen({})}>
                  <Wand2 />
                </Button>
              )}
            </div>
          </div>

          {available === 0 ? (
            <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <AlertTriangle className="size-4" /> Le partiel est trop proche pour planifier des révisions.
            </p>
          ) : sessions.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Aucune session (niveau « Aucun »). Tu peux en ajouter manuellement.</p>
          ) : (
            <ol className="divide-y">
              {sessions.map((s, i) => {
                const out = s.date < firstDay || s.date > lastDay;
                const open = expanded === s.key;
                return (
                  <li key={s.key} className={cn("px-3 py-2", out && "bg-destructive/5")}>
                    <div className="flex items-center gap-2">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-revision/15 text-[11px] font-bold text-revision">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input type="date" value={s.date} min={firstDay} max={lastDay}
                            onChange={(e) => e.target.value && patch(s.key, { date: e.target.value })}
                            className={cn("h-8 rounded-md border bg-card px-1.5 text-xs", out && "border-destructive text-destructive")} />
                          <input type="time" value={s.startTime ?? ""} onChange={(e) => patch(s.key, { startTime: e.target.value || null })}
                            className="h-8 w-[5.5rem] rounded-md border bg-card px-1.5 text-xs" />
                          <span className="text-xs text-muted-foreground">{fmtCap(fromDayKey(s.date), "EEEE")}</span>
                          {s.done && <span className="text-[11px] font-medium text-td">✓ faite</span>}
                        </div>
                        <input value={s.title} onChange={(e) => patch(s.key, { title: e.target.value })}
                          className="mt-1 w-full rounded-md bg-transparent px-1 py-0.5 text-sm font-medium outline-none hover:bg-card focus:bg-card focus:ring-1 focus:ring-ring" />
                      </div>
                      <button onClick={() => setExpanded(open ? null : s.key)} aria-label="Détails"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-card">
                        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
                      </button>
                      <button onClick={() => setSessions((x) => x.filter((y) => y.key !== s.key))} aria-label="Supprimer la session"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-card hover:text-destructive">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {open && (
                      <div className="mt-2 grid gap-2 pl-8 sm:grid-cols-[1fr_7rem]">
                        <Textarea rows={2} value={s.description} placeholder="Objectifs : chapitres, exercices, annales…"
                          onChange={(e) => patch(s.key, { description: e.target.value })} />
                        <Field label="Durée (min)">
                          <Input type="number" min={10} step={15} value={s.durationMinutes}
                            onChange={(e) => patch(s.key, { durationMinutes: Number(e.target.value) })} />
                        </Field>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="border-t px-3 py-2">
            <Button size="sm" variant="ghost" onClick={addSession}>
              <Plus /> Ajouter une session
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
