import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border bg-card text-card-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)} {...props} />;
}

export function CardHeader({
  title, icon, action, className, subtitle,
}: { title: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode; className?: string; subtitle?: React.ReactNode }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 pt-4 pb-2", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}

export function EmptyState({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground [&_svg]:size-5">
      {icon}
      {children}
    </div>
  );
}
