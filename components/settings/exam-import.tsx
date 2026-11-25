"use client";

import { useState, useTransition } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { saveExamImportSettings } from "@/app/actions";
import type { RevisionLevel } from "@/lib/db/schema";
import { LEVELS } from "@/lib/revision";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useToast } from "../ui/toast";

export function ExamImportCard({
  initial, imported, dismissed,
}: { initial: { enabled: boolean; level: RevisionLevel; customPercent: number }; imported: number; dismissed: number }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [level, setLevel] = useState<RevisionLevel>(initial.level);
  const [pct, setPct] = useState(initial.customPercent);
  const [pending, start] = useTransition();
  const toast = useToast();

  const save = (restoreDismissed = false) =>
    start(async () => {
      try {
        const r = await saveExamImportSettings({ enabled, level, customPercent: pct, restoreDismissed });
        toast(
          r.created || r.linked || r.updated
            ? `${r.created} partiel(s) importé(s), ${r.sessions} révision(s) planifiée(s)`
            : "Réglages enregistrés · aucun nouveau partiel",
        );
      } catch (e) {
        toast((e as Error).message, "error");
      }
    });

  return (
    <Card>
      <CardHeader icon={<GraduationCap />} title="Partiels depuis Celcat" subtitle={`${imported} partiel(s) importé(s) automatiquement`} />
      <CardContent className="space-y-3">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>
            Créer automatiquement un partiel pour chaque épreuve « Examens » de l&apos;emploi du temps, avec ses révisions.
            <span className="block text-xs text-muted-foreground">Si Celcat déplace l&apos;épreuve, la date suit. Un partiel importé que tu supprimes n&apos;est pas recréé.</span>
          </span>
        </label>
        <div className={cn(!enabled && "pointer-events-none opacity-50")}>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Niveau de révision des nouveaux partiels importés</p>
          <div className="flex flex-wrap gap-1.5">
            {LEVELS.map((l) => (
              <button key={l.id} onClick={() => setLevel(l.id)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium", level === l.id ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted")}>
                {l.label}{l.id !== "custom" && ` · ${l.percent} %`}
              </button>
            ))}
          </div>
          {level === "custom" && (
            <div className="mt-2 flex items-center gap-2">
              <Input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-24" />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Les révisions déjà générées ne changent pas : modifie chaque partiel dans l&apos;onglet Partiels.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save()} disabled={pending}>{pending && <Loader2 className="animate-spin" />} Enregistrer & importer</Button>
          {dismissed > 0 && (
            <Button variant="ghost" onClick={() => save(true)} disabled={pending}>Réimporter les {dismissed} partiel(s) supprimé(s)</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
