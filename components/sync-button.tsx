"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncNow } from "@/app/actions";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";
import { cn } from "@/lib/utils";

export function SyncButton({ compact = false }: { compact?: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      variant="outline"
      size={compact ? "icon-sm" : "sm"}
      disabled={pending}
      aria-label="Synchroniser Celcat"
      onClick={() =>
        start(async () => {
          const r = await syncNow();
          if (r.ok) toast(`Emploi du temps synchronisé${r.mode === "mock" ? " (démo)" : ""} · ${r.upserted} cours`);
          else toast(`Échec de la synchronisation : ${r.error}`, "error");
        })
      }
    >
      <RefreshCw className={cn(pending && "animate-spin")} />
      {!compact && <span>{pending ? "Synchro…" : "Synchroniser"}</span>}
    </Button>
  );
}
