export async function register() {
  // Le bloc n'est compilé que pour le runtime Node (élimination de code mort côté Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Tous les calculs de dates côté serveur se font dans le fuseau de l'école
    process.env.TZ = process.env.APP_TIMEZONE || "Europe/Paris";
    if (process.env.ENABLE_INTERNAL_CRON !== "false") {
      const { startScheduler } = await import("./lib/scheduler");
      startScheduler();
    }
  }
}
