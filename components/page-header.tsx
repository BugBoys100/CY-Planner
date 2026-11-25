import Link from "next/link";
import { Settings } from "lucide-react";

export function PageHeader({
  title, subtitle, actions, back,
}: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: React.ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 -mx-4 mb-4 border-b bg-background/85 px-4 backdrop-blur-xl md:static md:mx-0 md:mb-6 md:border-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
      <div className="flex min-h-14 items-center gap-3 py-2 md:min-h-0 md:py-0 md:pt-8">
        {back}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-tight md:text-2xl">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground md:text-sm">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          <Link href="/settings" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden" aria-label="Paramètres">
            <Settings className="size-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
