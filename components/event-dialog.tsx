"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarCheck, Link2, Loader2, Sparkles, Trash2, Undo2 } from "lucide-react";
import { createEvent, deleteEvent, getSuggestion, updateEvent } from "@/app/actions";
import type { EventKind, SessionType } from "@/lib/db/schema";
import type { SlotInfo, SmartSuggestion } from "@/lib/smart-link";
import { fmt, fmtRelative } from "@/lib/format";
import { cn, toDatetimeLocal } from "@/lib/utils";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/input";
import { TypeBadge } from "./ui/badge";
import { useToast } from "./ui/toast";

export interface CourseOption {
  id: number;
  name: string;
  color: string;
  slug: string;
}

export interface EventDraft {
  id?: number;
  courseId: number | null;
  kind: EventKind;
  title: string;
  description: string;
  startsAt: number;
  allDay: boolean;
  linkedCelcatEventId?: string | null;
  linkedSessionType?: SessionType | null;
}

export const KINDS: { id: EventKind; label: string; emoji: string }[] = [
  { id: "devoir", label: "Devoir", emoji: "📝" },
  { id: "exercice", label: "Exercice", emoji: "✏️" },
  { id: "projet", label: "Projet", emoji: "🛠️" },
  { id: "rendu", label: "Rendu", emoji: "📤" },
  { id: "autre", label: "Autre", emoji: "📌" },
];

const TYPE_LABEL: Record<SessionType, string> = { CM: "CM", TD: "TD", TP: "TP", AUTRE: "cours" };
const slotLabel = (s: SlotInfo) => (s.sessionType === "AUTRE" ? s.category || "cours" : s.sessionType);

function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 30, 0, 0);
  return d.getTime();
}

function autoTitle(kind: EventKind, type: string) {
  switch (kind) {
    case "devoir": return `Devoir à rendre en ${type}`;
    case "exercice": return `Exercices à préparer pour le ${type}`;
    case "projet": return `Avancement projet (${type})`;
    case "rendu": return `Rendu pour le ${type}`;
    default: return `À faire pour le ${type}`;
  }
}

export function EventDialog({
  open, onClose, courses, initial, defaultCourseId, defaultStartsAt,
}: {
  open: boolean;
  onClose: () => void;
  courses: CourseOption[];
  initial?: EventDraft | null;
  defaultCourseId?: number | null;
  defaultStartsAt?: number;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<EventDraft>(() => blank());
  const [titleTouched, setTitleTouched] = useState(false);
  const [suggestion, setSuggestion] = useState<SmartSuggestion | null>(null);
  const [loadingSug, setLoadingSug] = useState(false);

  function blank(): EventDraft {
    return {
      courseId: defaultCourseId ?? null,
      kind: "devoir",
      title: "",
      description: "",
      startsAt: defaultStartsAt ?? defaultStart(),
      allDay: false,
    };
  }

  // Réinitialisation à l'ouverture
  useEffect(() => {
    if (!open) return;
    setDraft(initial ?? blank());
    setTitleTouched(!!initial?.title);
    setSuggestion(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  // Recherche intelligente du dernier cours / prochain cours du même type
  useEffect(() => {
    if (!open || !draft.courseId) {
      setSuggestion(null);
      return;
    }
    let cancelled = false;
    setLoadingSug(true);
    getSuggestion(draft.courseId)
      .then((s) => !cancelled && setSuggestion(s))
      .finally(() => !cancelled && setLoadingSug(false));
    return () => {
      cancelled = true;
    };
  }, [open, draft.courseId]);

  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const course = courses.find((c) => c.id === draft.courseId);

  function linkTo(slot: SlotInfo) {
    setDraft((d) => ({
      ...d,
      startsAt: slot.start,
      allDay: false,
      linkedCelcatEventId: slot.id,
      linkedSessionType: slot.sessionType,
      title: titleTouched && d.title ? d.title : autoTitle(d.kind, slotLabel(slot)),
    }));
  }

  function unlink() {
    setDraft((d) => ({ ...d, linkedCelcatEventId: null, linkedSessionType: null }));
  }

  function save() {
    start(async () => {
      try {
        const payload = {
          courseId: draft.courseId,
          kind: draft.kind,
          title: draft.title || (course ? `${KINDS.find((k) => k.id === draft.kind)?.label} — ${course.name}` : "Événement"),
          description: draft.description,
          startsAt: draft.startsAt,
          allDay: draft.allDay,
          linkedCelcatEventId: draft.linkedCelcatEventId ?? null,
          linkedSessionType: draft.linkedSessionType ?? null,
        };
        if (draft.id) await updateEvent(draft.id, payload);
        else await createEvent(payload);
        toast(draft.id ? "Événement mis à jour" : "Événement ajouté ✓");
        onClose();
      } catch (e) {
        toast((e as Error).message, "error");
      }
    });
  }

  function remove() {
    if (!draft.id || !confirm("Supprimer cet événement ?")) return;
    start(async () => {
      await deleteEvent(draft.id!);
      toast("Événement supprimé");
      onClose();
    });
  }

  const linkedSlot =
    draft.linkedCelcatEventId && suggestion
      ? [suggestion.next, ...Object.values(suggestion.nextByType)].find((s) => s?.id === draft.linkedCelcatEventId)
      : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={draft.id ? "Modifier l'événement" : "Ajouter un événement"}
      description="Devoir, exercice à préparer, projet…"
      footer={
        <>
          {draft.id && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={remove} disabled={pending}>
              <Trash2 /> Supprimer
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => set("kind", k.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                draft.kind === k.id ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted",
              )}
            >
              {k.emoji} {k.label}
            </button>
          ))}
        </div>

        <Field label="Matière">
          <Select
            value={draft.courseId ?? ""}
            onChange={(e) => {
              set("courseId", e.target.value ? Number(e.target.value) : null);
              unlink();
            }}
          >
            <option value="">— Aucune —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>

        {/* Suggestion intelligente */}
        {draft.courseId && (
          <div className="rounded-xl border border-primary/25 bg-accent/60 p-3 text-sm">
            {loadingSug && !suggestion ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Recherche dans l&apos;emploi du temps…
              </div>
            ) : suggestion ? (
              <SuggestionBody
                s={suggestion}
                courseName={course?.name ?? ""}
                linkedId={draft.linkedCelcatEventId ?? null}
                linkedSlot={linkedSlot ?? null}
                onLink={linkTo}
                onUnlink={unlink}
              />
            ) : null}
          </div>
        )}

        <Field label="Titre">
          <Input
            value={draft.title}
            placeholder="Ex : Exercices 3 à 7 de la feuille de TD 4"
            onChange={(e) => {
              setTitleTouched(true);
              set("title", e.target.value);
            }}
          />
        </Field>

        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field label={draft.allDay ? "Date" : "Date et heure"}>
            {draft.allDay ? (
              <Input
                type="date"
                value={toDatetimeLocal(draft.startsAt).slice(0, 10)}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [y, m, d] = e.target.value.split("-").map(Number);
                  set("startsAt", new Date(y, m - 1, d, 0, 0).getTime());
                  unlink();
                }}
              />
            ) : (
              <Input
                type="datetime-local"
                value={toDatetimeLocal(draft.startsAt)}
                onChange={(e) => {
                  if (!e.target.value) return;
                  set("startsAt", new Date(e.target.value).getTime());
                  unlink();
                }}
              />
            )}
          </Field>
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={draft.allDay} onChange={(e) => set("allDay", e.target.checked)} />
            Journée
          </label>
        </div>

        <Field label="Description / consignes">
          <Textarea value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="Optionnel" rows={3} />
        </Field>
      </div>
    </Dialog>
  );
}

function SuggestionBody({
  s, courseName, linkedId, linkedSlot, onLink, onUnlink,
}: {
  s: SmartSuggestion;
  courseName: string;
  linkedId: string | null;
  linkedSlot: SlotInfo | null;
  onLink: (slot: SlotInfo) => void;
  onUnlink: () => void;
}) {
  const ref = s.reference;
  const others = (Object.entries(s.nextByType) as [SessionType, SlotInfo][]).filter(
    ([, slot]) => slot.id !== s.next?.id,
  );

  if (linkedId && linkedSlot) {
    return (
      <div className="flex items-center gap-2">
        <CalendarCheck className="size-4 shrink-0 text-td" />
        <p className="min-w-0 flex-1">
          Lié au <b>{slotLabel(linkedSlot)}</b> du <b>{fmt(linkedSlot.start, "EEEE d MMMM 'à' HH'h'mm")}</b>
          {linkedSlot.room && <span className="text-muted-foreground"> · {linkedSlot.room}</span>}
        </p>
        <Button size="sm" variant="ghost" onClick={onUnlink}>
          <Undo2 /> Délier
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 space-y-1">
          {ref ? (
            <p>
              {ref.state === "ongoing" ? "Tu es actuellement en " : ref.state === "just-ended" ? "Tu sors de " : "Ton dernier cours de cette matière : "}
              <TypeBadge type={ref.sessionType} label={slotLabel(ref)} className="align-middle" />{" "}
              {ref.state !== "past" ? <>de <b>{courseName}</b>.</> : <span className="text-muted-foreground">({fmtRelative(ref.end)})</span>}
            </p>
          ) : (
            <p className="text-muted-foreground">Aucun cours passé trouvé pour {courseName} dans l&apos;emploi du temps.</p>
          )}
          {s.next && ref ? (
            <p>
              Lier cet événement au prochain <b>{TYPE_LABEL[s.next.sessionType] === "cours" ? slotLabel(s.next) : s.next.sessionType}</b> le{" "}
              <b>{fmt(s.next.start, "EEEE d MMMM 'à' HH'h'mm")}</b> ?
            </p>
          ) : ref ? (
            <p className="text-muted-foreground">Pas de prochain {slotLabel(ref)} planifié.</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 pl-6">
        {s.next && ref && (
          <Button size="sm" onClick={() => onLink(s.next!)}>
            <Link2 /> Lier au prochain {slotLabel(s.next)}
          </Button>
        )}
        {others.map(([type, slot]) => (
          <Button key={type} size="sm" variant="outline" onClick={() => onLink(slot)}>
            {slotLabel(slot)} · {fmt(slot.start, "EEE d MMM HH'h'mm")}
          </Button>
        ))}
      </div>
    </div>
  );
}
