"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft, Bold, Check, Code, Columns2, Eye, Heading2, Italic, Link2, List, ListChecks, Loader2, Pencil, Quote, Trash2,
} from "lucide-react";
import { deleteNote, saveNote } from "@/app/actions";
import { cn } from "@/lib/utils";
import { Select } from "../ui/input";

type Mode = "edit" | "split" | "preview";

export function NoteEditor({
  course, note, folders,
}: {
  course: { id: number; slug: string; name: string; color: string };
  note: { id: number; title: string; content: string; folderId: number | null; updatedAt: number };
  folders: { id: number; name: string; parentId: number | null }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [folderId, setFolderId] = useState<number | null>(note.folderId);
  const [mode, setMode] = useState<Mode>("split");
  const [status, setStatus] = useState<"saved" | "dirty" | "saving">("saved");
  const [, start] = useTransition();
  const ta = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title, content });
  latest.current = { title, content };

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) setMode(note.content ? "preview" : "edit");
  }, [note.content]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setStatus("saving");
    await saveNote(note.id, latest.current);
    setStatus("saved");
  }, [note.id]);

  const schedule = useCallback(() => {
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }, [flush]);

  // Sauvegarde à la fermeture / Ctrl+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        flush();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (timer.current) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
      if (timer.current) saveNote(note.id, latest.current);
    };
  }, [flush, note.id]);

  function wrap(before: string, after = before, placeholder = "texte") {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const sel = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    setContent(next);
    schedule();
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  }

  function linePrefix(prefix: string) {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const block = value.slice(lineStart, e);
    const replaced = block.split("\n").map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l)).join("\n");
    const next = value.slice(0, lineStart) + replaced + value.slice(e);
    setContent(next);
    schedule();
    requestAnimationFrame(() => el.focus());
  }

  const tools = [
    { icon: Heading2, label: "Titre", on: () => linePrefix("## ") },
    { icon: Bold, label: "Gras", on: () => wrap("**") },
    { icon: Italic, label: "Italique", on: () => wrap("_") },
    { icon: List, label: "Liste", on: () => linePrefix("- ") },
    { icon: ListChecks, label: "Tâches", on: () => linePrefix("- [ ] ") },
    { icon: Quote, label: "Citation", on: () => linePrefix("> ") },
    { icon: Code, label: "Code", on: () => wrap("```\n", "\n```", "code") },
    { icon: Link2, label: "Lien", on: () => wrap("[", "](https://)", "lien") },
  ];

  const backHref = `/courses/${course.slug}${note.folderId ? `?folder=${note.folderId}` : ""}`;

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col md:min-h-[calc(100dvh-2rem)]">
      <header className="pt-safe sticky top-0 z-20 -mx-4 border-b bg-background/90 px-4 backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pt-6">
        <div className="flex items-center gap-2 py-2">
          <Link href={backHref} onClick={() => timer.current && flush()} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Retour">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: course.color }} /> {course.name}
            </p>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); schedule(); }}
              className="w-full bg-transparent text-lg font-bold outline-none md:text-xl"
              placeholder="Titre de la note"
            />
          </div>
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            {status === "saving" ? <><Loader2 className="size-3 animate-spin" /> Enregistrement</> : status === "dirty" ? "Modifié" : <><Check className="size-3" /> Enregistré</>}
          </span>
          <button
            onClick={() => {
              if (!confirm("Supprimer cette note ?")) return;
              if (timer.current) clearTimeout(timer.current);
              timer.current = null;
              start(async () => { await deleteNote(note.id); router.push(backHref); });
            }}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
            aria-label="Supprimer"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <div className="flex rounded-lg border bg-card p-0.5">
            {([
              ["edit", "Écrire", Pencil],
              ["split", "Côte à côte", Columns2],
              ["preview", "Aperçu", Eye],
            ] as const).map(([m, label, Icon]) => (
              <button key={m} onClick={() => setMode(m)}
                className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", m === "split" && "hidden lg:flex",
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
          {mode !== "preview" && (
            <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto">
              {tools.map(({ icon: Icon, label, on }) => (
                <button key={label} onClick={on} title={label} className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          )}
          <Select
            value={folderId ?? ""}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              setFolderId(v);
              start(() => saveNote(note.id, { folderId: v }));
            }}
            className="ml-auto h-8 w-auto min-w-36 text-xs md:text-xs"
          >
            <option value="">📁 Racine</option>
            {folders.map((f) => <option key={f.id} value={f.id}>📁 {f.name}</option>)}
          </Select>
        </div>
      </header>

      <div className={cn("grid flex-1 gap-4 pt-3", mode === "split" && "lg:grid-cols-2")}>
        {mode !== "preview" && (
          <textarea
            ref={ta}
            value={content}
            onChange={(e) => { setContent(e.target.value); schedule(); }}
            placeholder={"# Chapitre 1\n\nÉcris tes notes en **Markdown**…\n\n- [ ] Exercice 3\n- Formule : `O(n log n)`"}
            className="min-h-[60dvh] w-full resize-none rounded-xl border bg-card p-4 font-mono text-[15px] leading-relaxed outline-none focus:ring-2 focus:ring-ring/40 md:text-sm"
            spellCheck
          />
        )}
        {mode !== "edit" && (
          <article className="prose-notes min-h-[60dvh] rounded-xl border bg-card p-4 md:p-6">
            {content.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (p) => <a {...p} target="_blank" rel="noopener noreferrer" /> }}>
                {content}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground">Rien à afficher pour l&apos;instant.</p>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
