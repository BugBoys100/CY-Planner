"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, GraduationCap, House, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Accueil", icon: House },
  { href: "/calendar", label: "Calendrier", icon: CalendarDays },
  { href: "/courses", label: "Cours", icon: BookOpen },
  { href: "/exams", label: "Partiels", icon: GraduationCap },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card/60 backdrop-blur md:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <GraduationCap className="size-5" />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-bold">CY Planner</span>
          <span className="block text-[11px] text-muted-foreground">Vie étudiante CY Tech</span>
        </span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(path, href) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-[18px]" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-3 pb-4">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(path, "/settings") ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Settings className="size-[18px]" />
          Paramètres
        </Link>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-card/90 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid h-16 max-w-md grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:scale-95",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-accent")}>
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
