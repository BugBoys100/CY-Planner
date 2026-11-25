"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight, Download, EllipsisVertical, File, FileArchive, FileCode, FileImage, FileText, Folder, FolderPlus,
  House, Loader2, NotebookPen, Pencil, FolderInput, Trash2, Upload,
} from "lucide-react";
import {
  createFolder, createNote, deleteFile, deleteFolder, deleteNote, moveFile, moveFolder, renameFile, renameFolder, saveNote,
} from "@/app/actions";
import type { PreviewKind } from "@/lib/storage";
import { fmt } from "@/lib/format";
import { cn, formatBytes } from "@/lib/utils";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Field, Input, Select } from "../ui/input";
import { useToast } from "../ui/toast";

interface FolderT { id: number; name: string; parentId: number | null }
interface FileT { id: number; name: string; folderId: number | null; size: number; mimeType: string; createdAt: number; preview: PreviewKind }
interface NoteT { id: number; title: string; folderId: number | null; updatedAt: number }

type Entry =
  | { type: "folder"; item: FolderT }
  | { type: "note"; item: NoteT }
  | { type: "file"; item: FileT };

function fileIcon(f: FileT) {
  if (f.preview === "image") return FileImage;
  if (f.preview === "pdf") return FileText;
  if (/zip|rar|7z|tar|gz/.test(f.mimeType) || /\.(zip|rar|7z|tar|gz)$/i.test(f.name)) return FileArchive;
  if (f.preview === "text") return FileCode;
  return File;
}

export function Explorer({
  course, folders, files, notes, initialFolder = null,
}: { course: { id: number; slug: string; color: string }; folders: FolderT[]; files: FileT[]; notes: NoteT[]; initialFolder?: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState<number | null>(folders.some((f) => f.id === initialFolder) ? initialFolder : null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<FileT | null>(null);
  const [rename, setRename] = useState<Entry | null>(null);
  const [move, setMove] = useState<Entry | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Synchronise le dossier courant dans l'URL (?folder=) pour les liens directs / retour arrière
  useEffect(() => {
    const url = new URL(window.location.href);
    if (current) url.searchParams.set("folder", String(current));
    else url.searchParams.delete("folder");
    window.history.replaceState(null, "", url);
  }, [current]);

  const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const breadcrumb = useMemo(() => {
    const path: FolderT[] = [];
    let f = current ? byId.get(current) : undefined;
    while (f) {
      path.unshift(f);
      f = f.parentId ? byId.get(f.parentId) : undefined;
    }
    return path;
  }, [current, byId]);

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const x of [...files, ...notes]) if (x.folderId) m.set(x.folderId, (m.get(x.folderId) ?? 0) + 1);
    for (const f of folders) if (f.parentId) m.set(f.parentId, (m.get(f.parentId) ?? 0) + 1);
    return m;
  }, [files, notes, folders]);

  const entries: Entry[] = [
    ...folders.filter((f) => f.parentId === current).map((item) => ({ type: "folder" as const, item })),
    ...notes.filter((n) => n.folderId === current).map((item) => ({ type: "note" as const, item })),
    ...files.filter((f) => f.folderId === current).map((item) => ({ type: "file" as const, item })),
  ];

  async function upload(list: FileList | File[]) {
    const arr = Array.from(list);
    if (!arr.length) return;
    setUploading({ done: 0, total: arr.length });
    let ok = 0;
    for (const f of arr) {
      const fd = new FormData();
      fd.set("courseId", String(course.id));
      fd.set("folderId", current ? String(current) : "");
      fd.append("files", f);
      const res = await fetch("/api/files", { method: "POST", body: fd });
      if (res.ok) ok++;
      else toast(`${f.name} : ${(await res.json().catch(() => ({}))).error ?? "échec"}`, "error");
      setUploading({ done: ok, total: arr.length });
    }
    setUploading(null);
    if (ok) toast(`${ok} fichier${ok > 1 ? "s" : ""} importé${ok > 1 ? "s" : ""}`);
    router.refresh();
  }

  function newFolder() {
    const name = prompt("Nom du dossier", "Nouveau dossier");
    if (name?.trim()) start(() => createFolder(course.id, current, name));
  }

  function newNote() {
    start(async () => {
      const id = await createNote(course.id, current);
      router.push(`/courses/${course.slug}/notes/${id}`);
    });
  }

  function remove(e: Entry) {
    const label = e.type === "folder" ? `le dossier « ${e.item.name} » et tout son contenu` : e.type === "note" ? `la note « ${e.item.title} »` : `« ${e.item.name} »`;
    if (!confirm(`Supprimer ${label} ?`)) return;
    start(async () => {
      if (e.type === "folder") await deleteFolder(e.item.id);
      else if (e.type === "note") await deleteNote(e.item.id);
      else await deleteFile(e.item.id);
      toast("Supprimé");
    });
  }

  const keyOf = (e: Entry) => `${e.type}-${e.item.id}`;

  return (
    <Card
      className={cn("relative transition-colors", dragOver && "border-primary bg-accent/40")}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
        <nav className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm">
          <button onClick={() => setCurrent(null)} className={cn("flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted", !current && "font-semibold")}>
            <House className="size-4" /> Fichiers
          </button>
          {breadcrumb.map((f) => (
            <span key={f.id} className="flex shrink-0 items-center">
              <ChevronRight className="size-3.5 text-muted-foreground" />
              <button onClick={() => setCurrent(f.id)} className={cn("rounded-md px-1.5 py-1 hover:bg-muted", f.id === current && "font-semibold")}>{f.name}</button>
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={newFolder} disabled={pending} title="Nouveau dossier"><FolderPlus /><span className="hidden sm:inline">Dossier</span></Button>
          <Button size="sm" variant="ghost" onClick={newNote} disabled={pending} title="Nouvelle note"><NotebookPen /><span className="hidden sm:inline">Note</span></Button>
          <Button size="sm" onClick={() => fileInput.current?.click()} disabled={!!uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            <span className="hidden sm:inline">{uploading ? `${uploading.done}/${uploading.total}` : "Importer"}</span>
          </Button>
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ""; }} />
        </div>
      </div>

      {entries.length === 0 ? (
        <button onClick={() => fileInput.current?.click()} className="flex w-full flex-col items-center gap-2 px-4 py-10 text-sm text-muted-foreground hover:bg-muted/40">
          <Upload className="size-6" />
          Dossier vide — glisse des fichiers ici ou clique pour importer
          <span className="text-xs">PDF, images, archives, code…</span>
        </button>
      ) : (
        <ul className="divide-y">
          {entries.map((e) => {
            const k = keyOf(e);
            const Icon = e.type === "folder" ? Folder : e.type === "note" ? NotebookPen : fileIcon(e.item);
            const name = e.type === "note" ? e.item.title : e.item.name;
            const meta =
              e.type === "folder" ? `${counts.get(e.item.id) ?? 0} élément${(counts.get(e.item.id) ?? 0) > 1 ? "s" : ""}`
              : e.type === "note" ? `Note · modifiée ${fmt(e.item.updatedAt, "d MMM HH:mm")}`
              : `${formatBytes(e.item.size)} · ${fmt(e.item.createdAt, "d MMM yyyy")}`;
            const open = () => {
              if (e.type === "folder") setCurrent(e.item.id);
              else if (e.type === "note") router.push(`/courses/${course.slug}/notes/${e.item.id}`);
              else setPreview(e.item);
            };
            return (
              <li key={k} className="group relative flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                <button onClick={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span
                    className={cn("grid size-9 shrink-0 place-items-center rounded-lg", e.type !== "folder" && "bg-muted text-muted-foreground")}
                    style={e.type === "folder" ? { background: `${course.color}1f`, color: course.color } : undefined}
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{meta}</span>
                  </span>
                </button>
                {e.type === "file" && (
                  <a href={`/api/files/${e.item.id}?download`} className="hidden rounded-md p-1.5 text-muted-foreground hover:bg-card hover:text-foreground sm:block" aria-label="Télécharger">
                    <Download className="size-4" />
                  </a>
                )}
                <div className="relative">
                  <button onClick={() => setMenu(menu === k ? null : k)} className="rounded-md p-1.5 text-muted-foreground hover:bg-card hover:text-foreground" aria-label="Actions">
                    <EllipsisVertical className="size-4" />
                  </button>
                  {menu === k && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} />
                      <div className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-xl border bg-card py-1 shadow-xl">
                        {e.type === "file" && (
                          <a href={`/api/files/${e.item.id}?download`} className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted">
                            <Download className="size-4" /> Télécharger
                          </a>
                        )}
                        <button onClick={() => { setMenu(null); setRename(e); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted"><Pencil className="size-4" /> Renommer</button>
                        <button onClick={() => { setMenu(null); setMove(e); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted"><FolderInput className="size-4" /> Déplacer</button>
                        <button onClick={() => { setMenu(null); remove(e); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-destructive hover:bg-muted"><Trash2 className="size-4" /> Supprimer</button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-accent/70 text-sm font-medium text-accent-foreground">
          Dépose pour importer dans « {breadcrumb.at(-1)?.name ?? "Fichiers"} »
        </div>
      )}

      <FilePreview file={preview} onClose={() => setPreview(null)} />
      <RenameDialog entry={rename} onClose={() => setRename(null)} onSave={(e, v) => start(async () => {
        if (e.type === "folder") await renameFolder(e.item.id, v);
        else if (e.type === "file") await renameFile(e.item.id, v);
        else await saveNote(e.item.id, { title: v });
        setRename(null);
      })} />
      <MoveDialog entry={move} folders={folders} onClose={() => setMove(null)} onSave={(e, target) => start(async () => {
        try {
          if (e.type === "folder") await moveFolder(e.item.id, target);
          else if (e.type === "file") await moveFile(e.item.id, target);
          else await saveNote(e.item.id, { folderId: target });
          setMove(null);
          toast("Déplacé");
        } catch (err) {
          toast((err as Error).message, "error");
        }
      })} />
    </Card>
  );
}

function RenameDialog({ entry, onClose, onSave }: { entry: Entry | null; onClose: () => void; onSave: (e: Entry, v: string) => void }) {
  const [v, setV] = useState("");
  useEffect(() => { if (entry) setV(entry.type === "note" ? entry.item.title : entry.item.name); }, [entry]);
  if (!entry) return null;
  return (
    <Dialog open onClose={onClose} size="sm" title="Renommer"
      footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={() => onSave(entry, v)} disabled={!v.trim()}>Renommer</Button></>}>
      <form onSubmit={(ev) => { ev.preventDefault(); onSave(entry, v); }}>
        <Input autoFocus value={v} onChange={(e) => setV(e.target.value)} />
      </form>
    </Dialog>
  );
}

function folderPaths(folders: FolderT[]) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const pathOf = (f: FolderT): string => (f.parentId && byId.get(f.parentId) ? `${pathOf(byId.get(f.parentId)!)} / ${f.name}` : f.name);
  return folders.map((f) => ({ id: f.id, path: pathOf(f) })).sort((a, b) => a.path.localeCompare(b.path));
}

function MoveDialog({ entry, folders, onClose, onSave }: { entry: Entry | null; folders: FolderT[]; onClose: () => void; onSave: (e: Entry, target: number | null) => void }) {
  const [target, setTarget] = useState<string>("");
  useEffect(() => {
    if (!entry) return;
    const cur = entry.type === "folder" ? entry.item.parentId : entry.item.folderId;
    setTarget(cur ? String(cur) : "");
  }, [entry]);
  if (!entry) return null;
  const options = folderPaths(folders).filter((f) => !(entry.type === "folder" && f.id === entry.item.id));
  return (
    <Dialog open onClose={onClose} size="sm" title="Déplacer vers…"
      footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={() => onSave(entry, target ? Number(target) : null)}>Déplacer</Button></>}>
      <Field label="Dossier de destination">
        <Select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">📁 Racine de la matière</option>
          {options.map((f) => <option key={f.id} value={f.id}>{f.path}</option>)}
        </Select>
      </Field>
    </Dialog>
  );
}

function FilePreview({ file, onClose }: { file: FileT | null; onClose: () => void }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(null);
    if (file?.preview === "text") {
      fetch(`/api/files/${file.id}`).then((r) => r.text()).then((t) => setText(t.slice(0, 200_000)));
    }
  }, [file]);
  if (!file) return null;
  const src = `/api/files/${file.id}`;
  return (
    <Dialog open onClose={onClose} size="xl" title={file.name} description={`${formatBytes(file.size)} · ${file.mimeType}`}
      footer={<>
        <a href={src} target="_blank" rel="noopener noreferrer" className="mr-auto text-sm text-primary hover:underline">Ouvrir dans un onglet</a>
        <a href={`${src}?download`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"><Download className="size-4" /> Télécharger</a>
      </>}>
      {file.preview === "pdf" && <iframe src={src} title={file.name} className="h-[70dvh] w-full rounded-lg border bg-white" />}
      {file.preview === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={file.name} className="mx-auto max-h-[70dvh] rounded-lg object-contain" />
      )}
      {file.preview === "text" && (
        <pre className="max-h-[70dvh] overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">{text ?? "Chargement…"}</pre>
      )}
      {file.preview === "none" && (
        <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
          <File className="size-10" />
          Pas d&apos;aperçu disponible pour ce type de fichier.
        </div>
      )}
    </Dialog>
  );
}

