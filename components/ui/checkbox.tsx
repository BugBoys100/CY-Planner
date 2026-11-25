"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function CheckCircle({
  checked, onChange, color, disabled, label,
}: { checked: boolean; onChange: (v: boolean) => void; color?: string; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label ?? (checked ? "Marquer comme non fait" : "Marquer comme fait")}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all active:scale-90",
        checked ? "border-transparent text-white" : "hover:bg-muted",
      )}
      style={{ borderColor: checked ? "transparent" : color, background: checked ? color ?? "var(--primary)" : undefined }}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </button>
  );
}
