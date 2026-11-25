import { GraduationCap } from "lucide-react";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  return (
    <div className="grid min-h-[80dvh] place-items-center">
      <form action="/api/auth/login" method="post" className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><GraduationCap className="size-5" /></span>
          <div>
            <h1 className="font-bold">CY Planner</h1>
            <p className="text-xs text-muted-foreground">Accès protégé</p>
          </div>
        </div>
        <input type="hidden" name="next" value={next} />
        <input name="password" type="password" required autoFocus placeholder="Mot de passe"
          className="h-11 w-full rounded-lg border bg-background px-3 text-[16px] outline-none focus:ring-2 focus:ring-ring/50" />
        {error && <p className="text-sm text-destructive">Mot de passe incorrect.</p>}
        <button className="h-11 w-full rounded-lg bg-primary font-medium text-primary-foreground">Entrer</button>
      </form>
    </div>
  );
}
