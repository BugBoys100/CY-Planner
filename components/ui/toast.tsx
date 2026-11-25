"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; tone: "default" | "error" | "success" };
const ToastCtx = React.createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((message: string, tone: Toast["tone"] = "default") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto max-w-sm animate-sheet rounded-xl border px-4 py-2.5 text-sm shadow-lg",
              t.tone === "error" ? "border-destructive/40 bg-card text-destructive" : "bg-foreground text-background",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => React.useContext(ToastCtx);
