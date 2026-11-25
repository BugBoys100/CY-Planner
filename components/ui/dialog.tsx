"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Modale responsive : bottom-sheet plein écran sur mobile, fenêtre centrée sur desktop. */
export function Dialog({
  open, onClose, title, description, children, footer, size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  const width = { sm: "md:max-w-md", md: "md:max-w-lg", lg: "md:max-w-2xl", xl: "md:max-w-4xl" }[size];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-in bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          "relative flex max-h-[94dvh] w-full animate-sheet flex-col rounded-t-2xl border bg-card shadow-2xl md:max-h-[90dvh] md:rounded-2xl",
          width,
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border md:hidden" />
        <div className="flex items-start justify-between gap-4 px-5 pt-3 pb-3 md:pt-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Fermer">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
