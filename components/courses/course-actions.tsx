"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, EllipsisVertical, GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCourse, updateCourse } from "@/app/actions";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Field, Input } from "../ui/input";
import { useToast } from "../ui/toast";
import { ColorPicker } from "./new-course";
import { EventDialog, type CourseOption } from "../event-dialog";
import { ExamDialog } from "../exam-dialog";

export function CourseActions({
  course, courses,
}: { course: { id: number; name: string; color: string; archived: boolean }; courses: CourseOption[] }) {
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const [ev, setEv] = useState(false);
  const [ex, setEx] = useState(false);
  const [name, setName] = useState(course.name);
  const [color, setColor] = useState(course.color);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setEv(true)}><Plus /><span className="hidden sm:inline">Devoir</span></Button>
      <div className="relative">
        <Button size="icon-sm" variant="ghost" onClick={() => setMenu((m) => !m)} aria-label="Plus d'actions"><EllipsisVertical /></Button>
        {menu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
            <div className="absolute right-0 z-40 mt-1 w-52 overflow-hidden rounded-xl border bg-card py-1 shadow-xl">
              {[
                { icon: GraduationCap, label: "Planifier un partiel", on: () => setEx(true) },
                { icon: Pencil, label: "Renommer / couleur", on: () => setEdit(true) },
                {
                  icon: Archive, label: course.archived ? "Désarchiver" : "Archiver",
                  on: () => start(async () => { await updateCourse(course.id, { archived: !course.archived }); toast(course.archived ? "Matière restaurée" : "Matière archivée"); }),
                },
                {
                  icon: Trash2, label: "Supprimer", danger: true,
                  on: () => {
                    if (!confirm(`Supprimer « ${course.name} » avec tous ses fichiers, notes et partiels ?\n(Si elle vient de Celcat, elle sera recréée vide à la prochaine synchro.)`)) return;
                    start(async () => { await deleteCourse(course.id); router.push("/courses"); });
                  },
                },
              ].map(({ icon: Icon, label, on, danger }) => (
                <button key={label} disabled={pending} onClick={() => { setMenu(false); on(); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted ${danger ? "text-destructive" : ""}`}>
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={edit} onClose={() => setEdit(false)} size="sm" title="Modifier la matière"
        footer={<>
          <Button variant="outline" onClick={() => setEdit(false)}>Annuler</Button>
          <Button disabled={pending} onClick={() => start(async () => { await updateCourse(course.id, { name, color }); setEdit(false); toast("Matière mise à jour"); })}>Enregistrer</Button>
        </>}>
        <div className="space-y-4">
          <Field label="Nom"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Couleur"><ColorPicker value={color} onChange={setColor} /></Field>
        </div>
      </Dialog>
      <EventDialog open={ev} onClose={() => setEv(false)} courses={courses} defaultCourseId={course.id} />
      <ExamDialog open={ex} onClose={() => setEx(false)} courses={courses} defaultCourseId={course.id} />
    </>
  );
}
