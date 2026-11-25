"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BookMarked, Check, Code, ExternalLink, GitBranch, Link2, Loader2, NotebookPen, Pin, Plus, X } from "lucide-react";
import { addLink, deleteLink, saveMemo } from "@/app/actions";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input, Textarea } from "../ui/input";
import { useToast } from "../ui/toast";

function linkIcon(url: string) {
  const h = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
  if (/colab\.research|jupyter|kaggle|deepnote/.test(h)) return NotebookPen;
  if (/github|gitlab|bitbucket/.test(h)) return GitBranch;
  if (/notion|obsidian|docs\.google/.test(h)) return BookMarked;
  if (/moodle|cyu\.fr|cytech/.test(h)) return Code;
  return Link2;
}

export function MemoLinks({ courseId, memo, links }: { courseId: number; memo: string; links: { id: number; label: string; url: string }[] }) {
  const [value, setValue] = useState(memo);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function onChange(v: string) {
    setValue(v);
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await saveMemo(courseId, v);
      setStatus("saved");
    }, 700);
  }

  function submitLink() {
    if (!url.trim()) return;
    start(async () => {
      try {
        await addLink(courseId, label, url);
        setLabel("");
        setUrl("");
        setAdding(false);
      } catch (e) {
        toast((e as Error).message, "error");
      }
    });
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-accent/50 to-card">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Pin className="size-4 text-primary" /> Mémo & liens rapides</h2>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {status === "saving" && <><Loader2 className="size-3 animate-spin" /> Enregistrement…</>}
          {status === "saved" && <><Check className="size-3" /> Enregistré</>}
        </span>
      </div>
      <div className="space-y-3 px-4 pb-4">
        <div className="flex flex-wrap gap-1.5">
          {links.map((l) => {
            const Icon = linkIcon(l.url);
            return (
              <span key={l.id} className="group inline-flex items-center rounded-lg border bg-card text-sm shadow-sm">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 py-1.5 pr-1 pl-2.5 hover:text-primary">
                  <Icon className="size-3.5" /> {l.label} <ExternalLink className="size-3 opacity-40" />
                </a>
                <button onClick={() => start(() => deleteLink(l.id))} aria-label={`Supprimer ${l.label}`}
                  className="rounded-r-lg px-1.5 py-1.5 text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100">
                  <X className="size-3.5" />
                </button>
              </span>
            );
          })}
          {!adding && (
            <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-lg border border-dashed px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-card hover:text-foreground">
              <Plus className="size-3.5" /> Lien
            </button>
          )}
        </div>
        {adding && (
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); submitLink(); }}>
            <Input autoFocus placeholder="https://colab.research.google.com/…" value={url} onChange={(e) => setUrl(e.target.value)} className="sm:flex-[2]" />
            <Input placeholder="Libellé (optionnel)" value={label} onChange={(e) => setLabel(e.target.value)} className="sm:flex-1" />
            <div className="flex gap-2">
              <Button type="submit" disabled={pending || !url.trim()}>Ajouter</Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>Annuler</Button>
            </div>
          </form>
        )}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Mémo rapide : chapitres à revoir, consignes du prof, barème…"
          rows={3}
          className="resize-y bg-card/80"
        />
      </div>
    </Card>
  );
}
