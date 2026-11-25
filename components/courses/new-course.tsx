"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createCourse } from "@/app/actions";
import { COURSE_COLORS, cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Field, Input } from "../ui/input";
import { useToast } from "../ui/toast";

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COURSE_COLORS.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={c}
          className={cn("size-7 rounded-full ring-offset-2 ring-offset-card transition-transform active:scale-90", value === c && "ring-2 ring-foreground")}
          style={{ background: c }} />
      ))}
    </div>
  );
}

export function NewCourseButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const submit = () =>
    start(async () => {
      try {
        const slug = await createCourse(name, color);
        setOpen(false);
        setName("");
        router.push(`/courses/${slug}`);
      } catch (e) {
        toast((e as Error).message, "error");
      }
    });
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus /> <span className="hidden sm:inline">Nouvelle matière</span></Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="Nouvelle matière"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={submit} disabled={pending || !name.trim()}>Créer</Button></>}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field label="Nom"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Machine Learning" /></Field>
          <Field label="Couleur"><ColorPicker value={color} onChange={setColor} /></Field>
        </form>
      </Dialog>
    </>
  );
}
