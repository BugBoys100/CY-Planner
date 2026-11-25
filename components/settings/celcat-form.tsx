"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarSync, Check, KeyRound, Loader2, Search, TriangleAlert } from "lucide-react";
import { saveCelcatSettings, syncNow } from "@/app/actions";
import type { SyncStatus } from "@/lib/settings";
import { fmt } from "@/lib/format";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Field, Input, Select } from "../ui/input";
import { useToast } from "../ui/toast";

const TYPES = [
  { v: 103, l: "Groupe" },
  { v: 104, l: "Étudiant" },
  { v: 101, l: "Enseignant" },
  { v: 102, l: "Salle" },
];

export function CelcatSettingsForm({
  initial, lastSync,
}: {
  initial: { baseUrl: string; resourceId: string; resourceType: number; resourceLabel: string; hasCookie: boolean; username: string; hasPassword: boolean };
  lastSync: SyncStatus | null;
}) {
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [resourceId, setResourceId] = useState(initial.resourceId);
  const [resourceLabel, setResourceLabel] = useState(initial.resourceLabel);
  const [resourceType, setResourceType] = useState(initial.resourceType);
  const [cookie, setCookie] = useState("");
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; text: string; dept?: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/celcat/resources?q=${encodeURIComponent(q)}&type=${resourceType}&baseUrl=${encodeURIComponent(baseUrl)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erreur");
        setResults(json);
      } catch (e) {
        setSearchError((e as Error).message);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, resourceType, baseUrl]);

  const save = () =>
    start(async () => {
      try {
        const r = await saveCelcatSettings({
          baseUrl, resourceId, resourceType, resourceLabel, username,
          cookie: cookie || undefined,
          password: password || undefined,
        });
        setPassword("");
        setCookie("");
        if (r.ok) toast(`Enregistré · ${r.upserted} cours synchronisés (${r.mode === "mock" ? "démo" : "Celcat"})`);
        else toast(`Enregistré, mais la synchro a échoué : ${r.error}`, "error");
      } catch (e) {
        toast((e as Error).message, "error");
      }
    });

  return (
    <Card>
      <CardHeader icon={<CalendarSync />} title="Emploi du temps Celcat" subtitle="Laisse l'URL vide pour utiliser le mode démo" />
      <CardContent className="space-y-4">
        <Field label="URL de l'instance Celcat">
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            onBlur={() => {
              // Coller l'URL de ta page Celcat (…/cal?…&et=student&fid0=…) remplit tout automatiquement
              try {
                const u = new URL(baseUrl.trim());
                const types: Record<string, number> = { student: 104, group: 103, staff: 101, room: 102 };
                const et = u.searchParams.get("et");
                const fid = u.searchParams.get("fid0");
                if (et && types[et]) setResourceType(types[et]);
                if (fid) { setResourceId(fid); setResourceLabel(""); }
                setBaseUrl(u.origin + u.pathname.replace(/\/+$/, "").replace(/\/(cal|LdapLogin|Login)$/i, ""));
              } catch {}
            }}
            placeholder="https://celcat-calendar.cyu.fr"
            inputMode="url"
          />
          <p className="mt-1 text-xs text-muted-foreground">Astuce : colle directement l&apos;URL de ta page Celcat, le type et l&apos;identifiant sont déduits.</p>
        </Field>
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <Field label="Type">
            <Select value={resourceType} onChange={(e) => setResourceType(Number(e.target.value))}>
              {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </Select>
          </Field>
          <Field label="Rechercher ton groupe">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ING2 GI…" className="pl-9" />
              {searching && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
          </Field>
        </div>
        {searchError && <p className="text-xs text-destructive">{searchError}</p>}
        {results.length > 0 && (
          <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => { setResourceId(r.id); setResourceLabel(r.text); setQ(""); setResults([]); }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span>{r.text} {r.dept && <span className="text-xs text-muted-foreground">· {r.dept}</span>}</span>
                  {resourceId === r.id && <Check className="size-4 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Field label="Identifiant de la ressource (federationId)">
          <Input value={resourceId} onChange={(e) => { setResourceId(e.target.value); setResourceLabel(""); }} placeholder="Ex : 2024ING2GI2" />
          {resourceLabel && <p className="mt-1 text-xs text-muted-foreground">Sélection : {resourceLabel}</p>}
        </Field>
        <div className="rounded-lg border p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><KeyRound className="size-3.5" /> Connexion Celcat (recommandé)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Identifiant">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" placeholder="N° étudiant / identifiant CY" />
            </Field>
            <Field label="Mot de passe">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
                placeholder={initial.hasPassword ? "•••••• (enregistré)" : "Mot de passe Celcat"} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Le serveur se connecte seul via la page de connexion Celcat et renouvelle la session. Le mot de passe est stocké
            dans la base locale du serveur (ou mets-le dans <code>CELCAT_PASSWORD</code> du fichier <code>.env.local</code>).
          </p>
          {initial.hasPassword && (
            <button className="mt-1 text-xs text-destructive hover:underline" onClick={() => start(async () => {
              await saveCelcatSettings({ baseUrl, resourceId, resourceType, resourceLabel, username: "", password: "" });
              setUsername("");
              toast("Identifiants effacés");
            })}>Effacer les identifiants enregistrés</button>
          )}
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Avancé : cookie de session (alternative)</summary>
          <div className="mt-2 space-y-1">
            <Input value={cookie} onChange={(e) => setCookie(e.target.value)} placeholder={initial.hasCookie ? "•••••• (déjà défini)" : ".Calendar.Cookies=CfDJ8…"} />
            <p className="text-xs text-muted-foreground">
              Valeur du cookie <code>.Calendar.Cookies</code> (DevTools → Application → Cookies). Il expire à la fermeture de la
              session : à n&apos;utiliser que pour dépanner. Ignoré si un identifiant est renseigné.
            </p>
            {initial.hasCookie && (
              <button className="text-xs text-destructive hover:underline" onClick={() => start(async () => {
                await saveCelcatSettings({ baseUrl, resourceId, resourceType, resourceLabel, cookie: "" });
                toast("Cookie effacé");
              })}>Effacer le cookie</button>
            )}
          </div>
        </details>

        {lastSync && (
          <div className={`flex items-start gap-2 rounded-lg p-2.5 text-xs ${lastSync.ok ? "bg-muted" : "bg-destructive/10 text-destructive"}`}>
            {lastSync.ok ? <Check className="mt-0.5 size-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />}
            <span>
              Dernière synchro {fmt(lastSync.at, "d MMM 'à' HH:mm")} · {lastSync.mode === "mock" ? "mode démo" : "Celcat"} ·{" "}
              {lastSync.ok ? `${lastSync.upserted} séances, ${lastSync.removed} supprimées, ${lastSync.coursesCreated} nouvelles matières${lastSync.examsImported ? `, ${lastSync.examsImported} partiels importés` : ""}` : lastSync.error}
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={pending}>{pending && <Loader2 className="animate-spin" />} Enregistrer & synchroniser</Button>
          <Button variant="outline" disabled={pending} onClick={() => start(async () => {
            const r = await syncNow();
            toast(r.ok ? `${r.upserted} séances synchronisées` : `Échec : ${r.error}`, r.ok ? "default" : "error");
          })}>Synchroniser</Button>
        </div>
      </CardContent>
    </Card>
  );
}
