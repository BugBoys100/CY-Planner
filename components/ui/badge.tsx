import * as React from "react";
import { cn, hexToRgba } from "@/lib/utils";
import type { SessionType } from "@/lib/db/schema";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap", className)}
      {...props}
    />
  );
}

export const TYPE_STYLE: Record<SessionType, string> = {
  CM: "bg-cm/15 text-cm",
  TD: "bg-td/15 text-td",
  TP: "bg-tp/15 text-tp",
  AUTRE: "bg-autre/15 text-autre",
};
export const TYPE_BAR: Record<SessionType, string> = {
  CM: "bg-cm",
  TD: "bg-td",
  TP: "bg-tp",
  AUTRE: "bg-autre",
};

export function TypeBadge({ type, label, className }: { type: SessionType; label?: string; className?: string }) {
  return <Badge className={cn(TYPE_STYLE[type], className)}>{label || (type === "AUTRE" ? "Autre" : type)}</Badge>;
}

export function CourseBadge({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <Badge className={cn("max-w-full truncate", className)} style={{ background: hexToRgba(color, 0.14), color }}>
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{name}</span>
    </Badge>
  );
}
